from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    active = db.Column(db.Boolean, default=True)

    products = db.relationship('Product', backref='category', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
        }


class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, default='')
    price = db.Column(db.Float, nullable=False)
    image = db.Column(db.String(200), default='')
    active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'category_id': self.category_id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'image': self.image,
            'active': self.active,
        }


class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(50), nullable=False)
    address = db.Column(db.String(200), default='')
    delivery_option = db.Column(db.String(20), nullable=False)
    payment_method = db.Column(db.String(20), nullable=False)
    change_amount = db.Column(db.Float, default=0.0)
    observations = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default='novo')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('OrderItem', backref='order', lazy=True)

    def total(self):
        return sum(item.price * item.quantity for item in self.items)

    def to_dict(self, include_items=False):
        data = {
            'id': self.id,
            'customer_name': self.customer_name,
            'phone': self.phone,
            'address': self.address,
            'delivery_option': self.delivery_option,
            'payment_method': self.payment_method,
            'change_amount': self.change_amount,
            'observations': self.observations,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'total': self.total(),
        }

        if include_items:
            data['items'] = [item.to_dict() for item in self.items]

        return data


class OrderItem(db.Model):
    __tablename__ = 'order_items'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    note = db.Column(db.Text, default='')
    product_name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'product_id': self.product_id,
            'quantity': self.quantity,
            'note': self.note,
            'product_name': self.product_name,
            'price': self.price,
        }