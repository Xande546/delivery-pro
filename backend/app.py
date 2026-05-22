from datetime import datetime
from pathlib import Path
import os
import uuid
from typing import Dict, Any

from flask import Flask, jsonify, request, send_from_directory, session, redirect
from flask_cors import CORS
from werkzeug.utils import secure_filename

from .models import db, Category, Product, Order, OrderItem
from .print_utils import format_receipt, print_order


ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}


def create_app(test_config: Dict[str, Any] | None = None) -> Flask:
    BASE_DIR = Path(__file__).resolve().parent
    FRONTEND_STATIC = BASE_DIR.parent / 'frontend' / 'static'
    UPLOAD_DIR = FRONTEND_STATIC / 'uploads'
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    app = Flask(
        __name__,
        static_folder=str(FRONTEND_STATIC),
        static_url_path='',
    )

    database_url = os.environ.get('DATABASE_URL')

    if database_url:
        # Render/Supabase podem entregar a URL começando com postgres://.
        # SQLAlchemy espera postgresql://.
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    else:
        database_url = 'sqlite:///' + os.path.join(os.path.dirname(__file__), 'data.sqlite')

    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'delivery-lanchonete-pro-secret'),
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,
    )

    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    CORS(app)

    # Garante que as tabelas sejam criadas também quando rodar no Render/Gunicorn.
    with app.app_context():
        db.create_all()

    # =========================
    # LOGIN ADMIN
    # =========================

    ADMIN_USER = 'admin'
    ADMIN_PASSWORD = '123456'

    def admin_logged():
        return session.get('admin_logged') is True

    def allowed_image(filename: str) -> bool:
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

    @app.route('/')
    def index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/admin')
    def admin():
        if not admin_logged():
            return send_from_directory(app.static_folder, 'login.html')
        return send_from_directory(app.static_folder, 'admin.html')

    @app.route('/admin/relatorio')
    def relatorio():
        if not admin_logged():
            return redirect('/admin')
        return send_from_directory(app.static_folder, 'report.html')

    @app.route('/admin/produtos')
    def produtos_admin():
        if not admin_logged():
            return redirect('/admin')
        return send_from_directory(app.static_folder, 'products_admin.html')

    # =========================
    # LOGIN / LOGOUT
    # =========================

    @app.route('/login', methods=['POST'])
    def login():
        data = request.get_json(force=True)
        username = data.get('username')
        password = data.get('password')

        if username == ADMIN_USER and password == ADMIN_PASSWORD:
            session['admin_logged'] = True
            return jsonify({'success': True})

        return jsonify({'success': False, 'message': 'Usuário ou senha inválidos'}), 401

    @app.route('/logout')
    def logout():
        session.clear()
        return redirect('/admin')

    # =========================
    # API PÚBLICA
    # =========================

    @app.route('/api/categories')
    def api_categories():
        categories = Category.query.filter_by(active=True).all()
        return jsonify([c.to_dict() for c in categories])

    @app.route('/api/products')
    def api_products():
        products = Product.query.filter_by(active=True).all()
        return jsonify([p.to_dict() for p in products])

    @app.route('/api/order', methods=['POST'])
    def api_create_order():
        data = request.get_json(force=True)

        required_fields = ['customer_name', 'phone', 'delivery_option', 'payment_method', 'items']
        missing = [f for f in required_fields if not data.get(f)]

        if missing:
            return jsonify({'error': f'Campos obrigatórios ausentes: {", ".join(missing)}'}), 400

        order = Order(
            customer_name=data['customer_name'],
            phone=data['phone'],
            address=data.get('address', ''),
            delivery_option=data['delivery_option'],
            payment_method=data['payment_method'],
            change_amount=float(data.get('change_amount') or 0),
            observations=data.get('observations', ''),
            status='novo',
            created_at=datetime.now(),
        )

        db.session.add(order)
        db.session.flush()

        for item in data['items']:
            product = Product.query.get(item['product_id'])
            if not product:
                continue

            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=item.get('quantity', 1),
                note=item.get('note', ''),
                product_name=product.name,
                price=product.price,
            )
            db.session.add(order_item)

        db.session.commit()
        return jsonify({'status': 'success', 'order_id': order.id})

    # =========================
    # API ADMIN PROTEGIDA - PEDIDOS
    # =========================

    @app.route('/api/orders')
    def api_orders():
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        status_filter = request.args.get('status')
        query = Order.query

        if status_filter:
            query = query.filter_by(status=status_filter)

        orders = query.order_by(Order.created_at.desc()).all()
        return jsonify([o.to_dict(include_items=True) for o in orders])

    @app.route('/api/orders/<int:order_id>', methods=['PUT'])
    def api_update_order(order_id):
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        order = Order.query.get_or_404(order_id)
        data = request.get_json(force=True)
        new_status = data.get('status')
        valid_status = ['novo', 'em_preparo', 'saiu_entrega', 'finalizado', 'cancelado']

        if new_status not in valid_status:
            return jsonify({'error': 'Status inválido'}), 400

        order.status = new_status
        db.session.commit()
        return jsonify({'status': 'updated'})

    @app.route('/api/orders/<int:order_id>/print', methods=['POST'])
    def api_print_order(order_id):
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        order = Order.query.get_or_404(order_id)
        receipt_text = format_receipt(order)
        success, message = print_order(receipt_text)
        return jsonify({'success': success, 'message': message})

    # =========================
    # API ADMIN PROTEGIDA - CATEGORIAS
    # =========================

    @app.route('/api/admin/categories', methods=['GET'])
    def api_admin_categories():
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        categories = Category.query.order_by(Category.name.asc()).all()
        return jsonify([c.to_dict() for c in categories])

    @app.route('/api/admin/categories', methods=['POST'])
    def api_admin_create_category():
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        data = request.get_json(force=True)
        name = (data.get('name') or '').strip()

        if not name:
            return jsonify({'error': 'Informe o nome da categoria'}), 400

        exists = Category.query.filter(Category.name.ilike(name)).first()
        if exists:
            return jsonify({'error': 'Categoria já existe'}), 400

        category = Category(name=name, active=True)
        db.session.add(category)
        db.session.commit()
        return jsonify(category.to_dict())

    # =========================
    # API ADMIN PROTEGIDA - PRODUTOS
    # =========================

    @app.route('/api/admin/products', methods=['GET'])
    def api_admin_products():
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        products = Product.query.order_by(Product.id.desc()).all()
        return jsonify([p.to_dict() for p in products])

    @app.route('/api/admin/products', methods=['POST'])
    def api_admin_create_product():
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        data = request.get_json(force=True)
        name = (data.get('name') or '').strip()
        description = (data.get('description') or '').strip()
        image = (data.get('image') or '').strip()
        active = bool(data.get('active', True))

        try:
            price = float(str(data.get('price') or '0').replace(',', '.'))
            category_id = int(data.get('category_id'))
        except Exception:
            return jsonify({'error': 'Preço ou categoria inválidos'}), 400

        if not name:
            return jsonify({'error': 'Informe o nome do produto'}), 400

        product = Product(
            name=name,
            description=description,
            price=price,
            category_id=category_id,
            image=image,
            active=active,
        )
        db.session.add(product)
        db.session.commit()
        return jsonify(product.to_dict())

    @app.route('/api/admin/products/<int:product_id>', methods=['PUT'])
    def api_admin_update_product(product_id):
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        product = Product.query.get_or_404(product_id)
        data = request.get_json(force=True)

        name = (data.get('name') or '').strip()
        description = (data.get('description') or '').strip()
        image = (data.get('image') or '').strip()
        active = bool(data.get('active', True))

        try:
            price = float(str(data.get('price') or '0').replace(',', '.'))
            category_id = int(data.get('category_id'))
        except Exception:
            return jsonify({'error': 'Preço ou categoria inválidos'}), 400

        if not name:
            return jsonify({'error': 'Informe o nome do produto'}), 400

        product.name = name
        product.description = description
        product.price = price
        product.category_id = category_id
        product.image = image
        product.active = active

        db.session.commit()
        return jsonify(product.to_dict())

    @app.route('/api/admin/products/<int:product_id>/toggle', methods=['POST'])
    def api_admin_toggle_product(product_id):
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        product = Product.query.get_or_404(product_id)
        product.active = not product.active
        db.session.commit()
        return jsonify(product.to_dict())

    @app.route('/api/admin/upload-image', methods=['POST'])
    def api_admin_upload_image():
        if not admin_logged():
            return jsonify({'error': 'Não autorizado'}), 401

        if 'image' not in request.files:
            return jsonify({'error': 'Nenhuma imagem enviada'}), 400

        file = request.files['image']
        if not file or not file.filename:
            return jsonify({'error': 'Arquivo inválido'}), 400

        if not allowed_image(file.filename):
            return jsonify({'error': 'Formato inválido. Use PNG, JPG, JPEG, WEBP ou GIF'}), 400

        original_name = secure_filename(file.filename)
        ext = original_name.rsplit('.', 1)[1].lower()
        filename = f'produto_{uuid.uuid4().hex}.{ext}'
        filepath = UPLOAD_DIR / filename
        file.save(filepath)

        return jsonify({'path': f'uploads/{filename}', 'url': f'/uploads/{filename}'})

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
