# -*- coding: utf-8 -*-
"""Servidor local da FLORESTA: deixa o jogo aberto para os amigos na mesma rede."""
import http.server
import socketserver
import socket
import os

PORT = int(os.environ.get('PORT', '8787'))
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), Handler) as httpd:
    httpd.allow_reuse_address = True
    print('')
    print('  FLORESTA no ar.')
    print('  Neste computador:  http://localhost:%d' % PORT)
    print('  Amigos na mesma rede: http://%s:%d' % (lan_ip(), PORT))
    print('  (feche esta janela para desligar)')
    print('')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
