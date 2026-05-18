"""
Database initialization script for Delivery Lanchonete Pro.

Running this module will drop existing tables (if any), recreate them and
populate initial categories and products for testing.  It uses the
application factory defined in ``app.py`` and SQLAlchemy models from
``models.py``.

Usage::

    python db_init.py

This script is intended for local development.  In production you
should use a proper migration tool like Alembic.
"""

import json
import os
from pathlib import Path

from flask import current_app

from .app import create_app
from .models import db, Category, Product


def load_sample_data() -> None:
    """Insert sample categories and products into the database."""
    # Predefined categories and products.  You can edit or extend this list.
    categories = [
        {'name': 'Lanches'},
        {'name': 'Porções'},
        {'name': 'Bebidas'},
        {'name': 'Combos'},
    ]
    products = [
        # Lanches
        {'category': 'Lanches', 'name': 'X-Burger',
         'description': 'Hambúrguer, queijo, alface e tomate',
         'price': 12.50, 'image': 'images/xburger.png'},
        {'category': 'Lanches', 'name': 'X-Salada',
         'description': 'Hambúrguer, queijo, alface, tomate e maionese',
         'price': 13.50, 'image': 'images/xsalada.png'},
        {'category': 'Porções', 'name': 'Batata Frita',
         'description': 'Porção de batata frita crocante',
         'price': 8.00, 'image': 'images/batata_frita.png'},
        {'category': 'Bebidas', 'name': 'Refrigerante Lata',
         'description': 'Refrigerante 350ml (Coca-Cola, Guaraná, etc.)',
         'price': 5.00, 'image': 'images/refrigerante.png'},
        {'category': 'Bebidas', 'name': 'Suco Natural',
         'description': 'Suco de laranja ou limão',
         'price': 6.00, 'image': 'images/suco.png'},
        {'category': 'Combos', 'name': 'Combo 1',
         'description': 'X-Burger + Batata + Refrigerante',
         'price': 22.00, 'image': 'images/combo1.png'},
    ]
    # Insert categories
    category_map = {}
    for cat in categories:
        c = Category(name=cat['name'], active=True)
        db.session.add(c)
        db.session.flush()
        category_map[c.name] = c
    # Insert products
    for prod in products:
        c = category_map.get(prod['category'])
        if not c:
            continue
        p = Product(
            category_id=c.id,
            name=prod['name'],
            description=prod['description'],
            price=prod['price'],
            image=prod['image'],
            active=True,
        )
        db.session.add(p)
    db.session.commit()


def main() -> None:
    app = create_app({'SQLALCHEMY_DATABASE_URI': 'sqlite:///' + os.path.join(os.path.dirname(__file__), 'data.sqlite')})
    with app.app_context():
        # Drop and recreate tables
        db.drop_all()
        db.create_all()
        load_sample_data()
        print('Banco de dados inicializado com dados de exemplo.')


if __name__ == '__main__':
    main()