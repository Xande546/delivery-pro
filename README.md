# Delivery Lanchonete Pro

**Delivery Lanchonete Pro** é um sistema completo de cardápio e gestão de
pedidos inspirado em plataformas como iFood, desenvolvido para rodar
localmente no notebook da lanchonete.  O cliente acessa um site, escolhe
os produtos, informa seus dados e envia o pedido.  No notebook da
lanchonete, um painel de administração exibe os pedidos em tempo real
com alertas sonoros e opções de atualização de status e impressão.

## Funcionalidades principais

### Site do cliente

* Cardápio responsivo dividido em categorias (lanches, porções, bebidas e
  combos).  Os produtos exibem imagem, nome, descrição e preço.
* Carrinho com ajuste de quantidades, observação por item e cálculo de
  total em tempo real.
* Formulário para nome, telefone, endereço (quando entrega), método de
  pagamento (Pix, dinheiro, cartão) e campo de troco.
* Envio do pedido via **POST /api/order**, armazenando todas as
  informações no banco de dados.

### Painel da lanchonete

* Tabela de pedidos **novos** com ações para aceitar, enviar para entrega,
  finalizar, cancelar e imprimir o pedido.
* Alertas sonoros quando novos pedidos chegam (implementados com a API
  Web Audio).
* Resumo do dia com número total de pedidos e receita total,
  além de histórico de pedidos com seus respectivos status.
* Impressão do pedido via impressora térmica ESC/POS (quando configurada) ou
  geração de arquivo PDF/TXT para testes.  O código de impressão usa a
  biblioteca `python‑escpos` e segue o modelo de servidor de impressão
  local descrito em um tutorial que explica que impressoras térmicas
  falam ESC/POS e podem ser acessadas diretamente por USB【571600737830334†L61-L69】.  O mesmo
  tutorial demonstra como expor uma API Flask simples para enviar texto à
  impressora【571600737830334†L152-L203】.

### Administração

* Script `db_init.py` para iniciar o banco de dados SQLite com categorias
  e produtos de exemplo.
* Possibilidade de migrar facilmente para PostgreSQL alterando a URI em
  `app.py` ou via variável de ambiente `SQLALCHEMY_DATABASE_URI`.
* Código organizado em pastas para facilitar futuras expansões, como
  cadastro de produtos e geração de relatórios avançados.

## Estrutura de pastas

```
delivery_lanchonete_pro/
├── backend/
│   ├── __init__.py          # inicializador do pacote
│   ├── app.py               # aplicação Flask com rotas da API
│   ├── models.py            # modelos SQLAlchemy (categorias, produtos, pedidos)
│   ├── db_init.py           # script para criar/trocar o banco com dados de exemplo
│   ├── print_utils.py       # formatação e impressão/geração de PDF
│   └── requirements.txt     # dependências Python
├── frontend/
│   └── static/
│       ├── index.html       # página do cardápio (cliente)
│       ├── admin.html       # painel de administração
│       ├── report.html      # relatório simples
│       ├── styles.css       # estilos personalizados
│       ├── scripts.js       # lógica de front‑end (cardápio)
│       └── images/          # ícones de produtos
└── README.md                # este arquivo
```

## Pré‑requisitos

Para rodar o sistema localmente você precisa de:

* **Python 3.10+**
* Pacotes listados em `backend/requirements.txt`.  Instale-os com:

  ```sh
  pip install -r backend/requirements.txt
  ```

  As dependências opcionais (`python‑escpos` e `reportlab`) são
  recomendadas para impressão em impressoras térmicas e geração de PDF,
  respectivamente.  Caso não sejam instaladas, a aplicação cairá no
  modo de geração de arquivos `.txt`.

* É recomendável criar um ambiente virtual Python para isolar as
  dependências.

## Configuração inicial

1. Clone ou copie este diretório para o notebook da lanchonete.
2. Acesse a pasta `backend` e execute o script de inicialização do banco:

   ```sh
   cd delivery_lanchonete_pro/backend
   python db_init.py
   ```

   Isso criará o arquivo `data.sqlite` com categorias e produtos de
   exemplo.  Você pode editar `db_init.py` para adicionar ou remover
   itens.

3. Execute a aplicação Flask:

   ```sh
   python app.py
   ```

   Por padrão o servidor ficará acessível em `http://localhost:5000/`.

4. Abra o navegador do cliente e acesse o endereço do servidor.  Para
   abrir o painel da lanchonete, acesse `/admin`.  Para ver um relatório
   simples de todos os pedidos, acesse `/admin/relatorio`.

## Impressão em impressora térmica

O módulo `print_utils.py` utiliza a biblioteca `python‑escpos` para
comunicar com impressoras ESC/POS ligadas via USB.  Segundo um
tutorial sobre como construir um servidor de impressão local, basta
enviar bytes para a impressora para que ela imprima【571600737830334†L61-L69】.  O
mesmo tutorial mostra um exemplo de API HTTP em Flask que recebe
texto JSON e chama os métodos `text()` e `cut()` do objeto
``Usb``【571600737830334†L152-L203】, modelo que seguimos aqui.  Caso a biblioteca ou a
impressora não estejam disponíveis, a função `print_order` salva o
recebido como PDF (se `reportlab` estiver instalado) ou arquivo `.txt`
na pasta `backend/printouts`.

Para configurar sua impressora:

1. Instale `python‑escpos` conforme indicado em `requirements.txt`.
2. Descubra o ``vendor_id`` e o ``product_id`` do dispositivo usando
   `lsusb` (Linux) ou o gerenciador de dispositivos (Windows).
3. Edite a chamada `print_order` em `app.py` ou modifique
   `print_utils.print_order` para passar esses valores.
4. Teste a impressão acessando `/admin` e clicando em **Imprimir** em
   um pedido.

## Notas finais

O objetivo deste sistema é fornecer uma base funcional e de código
aberto para pequenas lanchonetes que desejam oferecer pedidos online
sem pagar por soluções terceirizadas.  O código está organizado de
forma que seja fácil realizar melhorias, como cadastro de produtos e
categorias via interface web, integração com pagamento via Pix, envio
de notificações aos clientes ou publicação online para atendimento 24h.

Sinta‑se à vontade para customizar e expandir conforme necessário.