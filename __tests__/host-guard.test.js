// Pruebas del guard de hosts: `hostGuard` (app.js) y el parseo de `config/hosts.js`.
//
// `config/hosts.js` lee los ALLOWED_* al cargarse, así que cada escenario usa
// `jest.resetModules()` y vuelve a requerir la app con el entorno deseado. Ninguna
// prueba toca rutas de proveedores, así que nunca hay red.

const request = require('supertest');

// Cada resetModules() vuelve a configurar log4js, y su soporte de clustering agrega un
// listener de 'message' al emitter de `cluster` sin poder quitar el anterior (remueve otra
// referencia de función). Subimos el límite para silenciar la falsa alerta de fuga.
require('cluster').setMaxListeners(50);

const ALLOWED_ENV = ['ALLOWED_HOSTS', 'ALLOWED_IPS', 'ALLOWED_ORIGINS'];

// Carga una copia fresca de la app con los ALLOWED_* indicados (y limpia el resto).
function loadApp(env = {}) {
  jest.resetModules();
  for (const key of ALLOWED_ENV) delete process.env[key];
  Object.assign(process.env, env);
  return require('../app');
}

function loadHosts(env = {}) {
  jest.resetModules();
  for (const key of ALLOWED_ENV) delete process.env[key];
  Object.assign(process.env, env);
  return require('../config/hosts');
}

afterEach(() => {
  for (const key of ALLOWED_ENV) delete process.env[key];
});

describe('hostGuard: ALLOWED_HOSTS', () => {
  it('no restringe cuando la variable no está definida', async () => {
    const app = loadApp();

    const res = await request(app).get('/').set('Host', 'cualquiera.example.gob.mx');

    expect(res.status).toBe(200);
  });

  it('rechaza con 403 cuando el Host no está en la lista', async () => {
    const app = loadApp({ ALLOWED_HOSTS: 's1.example.gob.mx' });

    const res = await request(app).get('/').set('Host', 'evil.example.com');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Host no autorizado' });
  });

  it('acepta el Host listado, sin importar mayúsculas', async () => {
    const app = loadApp({ ALLOWED_HOSTS: 'S1.EXAMPLE.GOB.MX' });

    const res = await request(app).get('/').set('Host', 's1.example.gob.mx');

    expect(res.status).toBe(200);
  });

  it('compara contra toda la lista separada por comas, recortando espacios', async () => {
    const app = loadApp({ ALLOWED_HOSTS: 'otro.gob.mx, s1.example.gob.mx ' });

    const res = await request(app).get('/').set('Host', 's1.example.gob.mx');

    expect(res.status).toBe(200);
  });
});

describe('hostGuard: ALLOWED_IPS', () => {
  it('rechaza con 403 cuando el cliente no está en la lista', async () => {
    const app = loadApp({ ALLOWED_IPS: '10.0.0.5' });

    const res = await request(app).get('/');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Cliente no autorizado' });
  });

  it('acepta el primer salto de X-Forwarded-For listado', async () => {
    const app = loadApp({ ALLOWED_IPS: '10.0.0.5' });

    const res = await request(app).get('/').set('X-Forwarded-For', '10.0.0.5, 203.0.113.9');

    expect(res.status).toBe(200);
  });

  it('ignora los saltos posteriores de X-Forwarded-For', async () => {
    const app = loadApp({ ALLOWED_IPS: '203.0.113.9' });

    const res = await request(app).get('/').set('X-Forwarded-For', '10.0.0.5, 203.0.113.9');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Cliente no autorizado' });
  });

  it('tolera el prefijo IPv4-mapped ::ffff: de ambos lados', async () => {
    const app = loadApp({ ALLOWED_IPS: '::FFFF:10.0.0.5' });

    const res = await request(app).get('/').set('X-Forwarded-For', '::ffff:10.0.0.5');

    expect(res.status).toBe(200);
  });
});

describe('hostGuard: logs de los accesos', () => {
  let originalWrite;
  let lines;

  beforeEach(() => {
    originalWrite = process.stdout.write;
    lines = [];
    process.stdout.write = (chunk) => {
      lines.push(String(chunk));
      return true;
    };
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  const parsed = () =>
    lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));

  it('registra host y client del que consulta en la línea de acceso', async () => {
    const app = loadApp();

    await request(app)
      .get('/')
      .set('Host', 's1.example.gob.mx')
      .set('X-Forwarded-For', '10.0.0.5');

    const access = parsed().find((l) => l.method === 'GET');
    expect(access).toMatchObject({
      path: '/',
      status: 200,
      host: 's1.example.gob.mx',
      client: '10.0.0.5'
    });
  });

  it('emite un ERROR con rid, host y client cuando rechaza, y el 403 comparte el rid', async () => {
    const app = loadApp({ ALLOWED_IPS: '10.0.0.5' });

    const res = await request(app).get('/').set('Host', 's1.example.gob.mx');

    expect(res.status).toBe(403);

    const error = parsed().find((l) => l.level === 'ERROR');
    expect(error).toMatchObject({
      logger: 'app.js',
      msg: 'cliente no autorizado',
      host: 's1.example.gob.mx',
      path: '/'
    });
    expect(error.rid).toBeTruthy();
    expect(error.client).toMatch(/127\.0\.0\.1/);

    const access = parsed().find((l) => l.method === 'GET');
    expect(access).toMatchObject({ status: 403, rid: error.rid });
  });
});

describe('hostGuard: ALLOWED_ORIGINS (CORS)', () => {
  it('con la variable sin definir permite cualquier origen', async () => {
    const app = loadApp();

    const res = await request(app)
      .options('/v1/search')
      .set('Origin', 'https://cualquiera.gob.mx')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('solo anuncia el origen listado', async () => {
    const app = loadApp({ ALLOWED_ORIGINS: 'https://front.example.gob.mx' });

    const permitido = await request(app)
      .options('/v1/search')
      .set('Origin', 'https://front.example.gob.mx')
      .set('Access-Control-Request-Method', 'POST');
    expect(permitido.status).toBe(204);
    expect(permitido.headers['access-control-allow-origin']).toBe('https://front.example.gob.mx');

    const otro = await request(app)
      .options('/v1/search')
      .set('Origin', 'https://otro.example.gob.mx')
      .set('Access-Control-Request-Method', 'POST');
    expect(otro.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('config/hosts.js', () => {
  it('permite todo cuando no hay variables definidas', () => {
    const hosts = loadHosts();

    expect(hosts.allowedOrigins).toEqual([]);
    expect(hosts.hostAllowed('s1.example.gob.mx')).toBe(true);
    expect(hosts.ipAllowed('203.0.113.9')).toBe(true);
  });

  it('recorta espacios, baja a minúsculas y descarta elementos vacíos', () => {
    const hosts = loadHosts({
      ALLOWED_HOSTS: ' S1.example.gob.mx ,, otro.gob.mx',
      ALLOWED_ORIGINS: ' https://Front.example.gob.mx ,'
    });

    expect(hosts.allowedOrigins).toEqual(['https://front.example.gob.mx']);
    expect(hosts.hostAllowed('s1.example.gob.mx')).toBe(true);
    expect(hosts.hostAllowed('otro.gob.mx')).toBe(true);
    expect(hosts.hostAllowed('fuera.gob.mx')).toBe(false);
  });
});
