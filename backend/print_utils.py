"""
Receipt formatting and printing utilities for Delivery Lanchonete Pro.

This module contains functions to format order receipts into human
readable text and to dispatch them to a connected printer.  It uses
``python-escpos`` when available to talk to ESC/POS thermal printers,
falling back to writing PDF files with ``reportlab`` if a printer
cannot be detected.  Both fallback options ensure orders can be
documented even when no hardware printer is attached.

The ESC/POS protocol description is well known and widely supported.
According to a tutorial on building a local thermal printer server,
thermal printers simply accept bytes over USB or serial ports; using
python‑escpos you can send text, barcodes and QR codes directly to
the device【571600737830334†L61-L69】.  The same article shows how to wrap
printing functionality behind a Flask API using a ``/print`` endpoint
that accepts JSON containing the text to print and then calls the
``text`` and ``cut`` methods on the ``Usb`` printer object【571600737830334†L152-L203】.

If ``python-escpos`` is not installed or no printer is connected,
``print_order`` will save the receipt as a PDF file in a ``printouts``
directory relative to the backend module.  The PDF is generated using
ReportLab, which must be installed separately (see
``requirements.txt``).
"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Tuple, Optional

try:
    from escpos.printer import Usb  # type: ignore
except Exception:
    Usb = None  # type: ignore

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.units import mm
except Exception:
    # ReportLab may not be installed.  We handle this gracefully below.
    A4 = None  # type: ignore
    getSampleStyleSheet = None  # type: ignore
    SimpleDocTemplate = None  # type: ignore
    Paragraph = None  # type: ignore
    Spacer = None  # type: ignore


def format_receipt(order: 'Order') -> str:
    """Return a formatted multi‑line receipt text for an order.

    The receipt includes the store name, order number, date/time, customer
    details, item lines with quantities and prices, observations, payment
    method and totals.  The formatting uses plain ASCII so it will
    render correctly on most thermal printers.

    Args:
        order: The ``Order`` instance for which to format the receipt.

    Returns:
        A string containing the formatted receipt.
    """
    lines = []
    lines.append('=== Delivery Lanchonete Pro ===')
    lines.append(f'Pedido: #{order.id}')
    lines.append(f'Data: {order.created_at.strftime("%d/%m/%Y %H:%M:%S")}')
    lines.append('')
    lines.append(f'Cliente: {order.customer_name}')
    lines.append(f'Telefone: {order.phone}')
    if order.delivery_option == 'entrega':
        lines.append(f'Endereço: {order.address or "(não informado)"}')
    else:
        lines.append('Retirada no balcão')
    lines.append(f'Forma de pagamento: {order.payment_method}')
    if order.payment_method.lower() == 'dinheiro' and order.change_amount:
        lines.append(f'Troco para: R$ {order.change_amount:.2f}')
    lines.append('')
    lines.append('Itens:')
    lines.append('-' * 32)
    for item in order.items:
        # Limit product name to 20 chars for alignment
        name = item.product_name[:20]
        qty = item.quantity
        price = item.price * qty
        lines.append(f'{qty}x {name:<20} R$ {price:.2f}')
        if item.note:
            lines.append(f'  Obs: {item.note}')
    lines.append('-' * 32)
    lines.append(f'Total: R$ {order.total():.2f}')
    if order.observations:
        lines.append('')
        lines.append(f'Observações: {order.observations}')
    lines.append('')
    lines.append('Obrigado pela preferência!')
    return '\n'.join(lines)


def print_order(text: str, vendor_id: Optional[int] = None,
                product_id: Optional[int] = None) -> Tuple[bool, str]:
    """Send the receipt text to a connected thermal printer or save as PDF.

    This function first attempts to send the receipt to a USB
    ESC/POS printer using ``python-escpos``.  If the library or printer
    is not available, it falls back to generating a PDF file.  The
    resulting file is stored in a ``printouts`` directory and can be
    printed manually using any PDF viewer.

    Args:
        text: The formatted receipt text to print.
        vendor_id: Optional USB vendor ID for the printer (e.g. 0x0416).
        product_id: Optional USB product ID for the printer (e.g. 0x5011).

    Returns:
        A tuple ``(success, message)`` where ``success`` indicates
        whether printing was attempted on a real printer and ``message``
        contains diagnostic information or the PDF path.
    """
    # Try to print via ESC/POS if available
    if Usb and vendor_id and product_id:
        try:
            printer = Usb(vendor_id, product_id)
            # Wrap long lines for small paper widths (32 chars for 58mm)
            for line in text.split('\n'):
                printer.text(line + '\n')
            printer.cut()
            return True, 'Pedido enviado para a impressora térmica.'
        except Exception as exc:
            # Continue to PDF fallback
            msg = f'Falha ao imprimir na impressora térmica: {exc}. Gerando PDF...'
    else:
        msg = 'Biblioteca ESC/POS não disponível ou impressora não configurada. Gerando PDF...'

    # Fallback to PDF
    pdf_path = save_receipt_pdf(text)
    return False, msg + f' Arquivo gerado: {pdf_path}'


def save_receipt_pdf(text: str) -> str:
    """Generate a simple PDF file containing the receipt text.

    Requires ReportLab to be installed.  The file is saved into a
    ``printouts`` directory relative to this module.  If ReportLab is
    not installed, the receipt will instead be saved as a plain text
    file with a ``.txt`` extension.

    Args:
        text: The receipt content to save.

    Returns:
        The filesystem path to the generated PDF or TXT file.
    """
    output_dir = Path(__file__).resolve().parent / 'printouts'
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    if SimpleDocTemplate and Paragraph and A4 and getSampleStyleSheet:
        filename = f'receipt_{timestamp}.pdf'
        filepath = output_dir / filename
        doc = SimpleDocTemplate(str(filepath), pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        # Split text into paragraphs
        for line in text.split('\n'):
            story.append(Paragraph(line, styles['Normal']))
            story.append(Spacer(1, 2 * mm))
        doc.build(story)
        return str(filepath)
    else:
        # Save as plain text
        filename = f'receipt_{timestamp}.txt'
        filepath = output_dir / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        return str(filepath)