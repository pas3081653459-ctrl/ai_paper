"""Optional whole-site HTTP Basic Auth (pages, PDFs, all APIs).

Enabled only when CHANNEL_LAB_SITE_PASSWORD is set (e.g. from the server's secrets env file);
local development without it stays open. CHANNEL_LAB_SITE_USER defaults to "pas".
/api/health stays open for monitoring. Credentials are compared in constant time and never logged.
"""
import base64
import hmac
import os

EXEMPT = {'/api/health'}


class SiteAuth:
    def __init__(self, app):
        self.app = app
        self.user = os.environ.get('CHANNEL_LAB_SITE_USER', 'pas').encode()
        self.password = os.environ.get('CHANNEL_LAB_SITE_PASSWORD', '').encode()

    def allowed(self, scope):
        for name, value in scope.get('headers', []):
            if name == b'authorization':
                scheme, _, token = value.partition(b' ')
                if scheme.lower() != b'basic':
                    return False
                try:
                    user, sep, password = base64.b64decode(token.strip(), validate=True).partition(b':')
                except ValueError:
                    return False
                ok_user = hmac.compare_digest(user, self.user)
                ok_password = hmac.compare_digest(password, self.password)
                return bool(sep) and ok_user and ok_password
        return False

    async def __call__(self, scope, receive, send):
        if (not self.password or scope['type'] not in ('http', 'websocket')
                or scope.get('path') in EXEMPT or self.allowed(scope)):
            return await self.app(scope, receive, send)
        if scope['type'] == 'websocket':
            return await send({'type': 'websocket.close', 'code': 1008})
        await send({'type': 'http.response.start', 'status': 401, 'headers': [
            (b'www-authenticate', b'Basic realm="Channel Lab", charset="UTF-8"'),
            (b'content-type', b'text/plain; charset=utf-8'), (b'cache-control', b'no-store')]})
        await send({'type': 'http.response.body', 'body': '需要登录 / Authentication required'.encode()})
