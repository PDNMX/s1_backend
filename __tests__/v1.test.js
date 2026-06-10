const mockEndpoints = [
  {
    supplier_id: 'TEST',
    supplier_name: 'Test Provider',
    system_id: 1,
    type: 'REST',
    levels: ['ESTATAL'],
    url: 'https://test.example.com/api',
    entities_url: '',
    token_url: 'https://test.example.com/auth',
    username: 'test_user',
    password: 'test_pass',
    client_id: 'test_client',
    client_secret: 'test_secret',
    scope: 'read',
    method: 'body',
    status: 'ACTIVE',
  },
  {
    supplier_id: 'TEST2',
    supplier_name: 'Test Provider 2',
    system_id: 2,
    type: 'REST',
    levels: ['MUNICIPAL'],
    url: 'https://test2.example.com/api',
    entities_url: '',
    token_url: 'https://test2.example.com/auth',
    username: 'test_user2',
    password: 'test_pass2',
    client_id: 'test_client2',
    client_secret: 'test_secret2',
    scope: 'read',
    method: 'body',
    status: 'ACTIVE',
  },
];

jest.mock('../endpoints.json', () => mockEndpoints);

jest.mock('../routes/rest_data', () => ({
  fetchData: jest.fn(),
  fetchEntities: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const { fetchData } = require('../routes/rest_data');

describe('GET /', () => {
  it('responde con título y versión', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('title', 'API del Sistema 1');
    expect(res.body).toHaveProperty('version', '1.0');
  });
});

describe('GET /v1/providers', () => {
  it('devuelve lista de proveedores activos', async () => {
    const res = await request(app).get('/v1/providers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty('supplier_id', 'TEST');
    expect(res.body[0]).toHaveProperty('supplier_name', 'Test Provider');
    expect(res.body[0]).toHaveProperty('levels');
    expect(res.body[0]).toHaveProperty('status', 'ACTIVE');
    expect(res.body[0]).not.toHaveProperty('password');
    expect(res.body[0]).not.toHaveProperty('client_secret');
  });
});

describe('POST /v1/summary', () => {
  beforeEach(() => {
    fetchData.mockReset();
  });

  it('busca en todos los proveedores cuando no hay filtros', async () => {
    const mockData = {
      supplier_id: 'TEST',
      supplier_name: 'Test Provider',
      levels: ['ESTATAL'],
      pagination: { page: 1, pageSize: 1, totalRows: 10, hasNextPage: true },
      results: [{ id: '1', nombre: 'Test' }],
    };
    fetchData.mockResolvedValue(mockData);

    const res = await request(app)
      .post('/v1/summary')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('filtra por nivel_gobierno', async () => {
    const mockData = {
      supplier_id: 'TEST2',
      supplier_name: 'Test Provider 2',
      levels: ['MUNICIPAL'],
      pagination: { page: 1, pageSize: 1, totalRows: 5, hasNextPage: false },
      results: [],
    };
    fetchData.mockResolvedValue(mockData);

    const res = await request(app)
      .post('/v1/summary')
      .send({ nivel_gobierno: 'MUNICIPAL' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].supplier_id).toBe('TEST2');
  });

  it('filtra por institucion', async () => {
    const mockData = {
      supplier_id: 'TEST',
      supplier_name: 'Test Provider',
      levels: ['ESTATAL'],
      pagination: { page: 1, pageSize: 1, totalRows: 3, hasNextPage: false },
      results: [],
    };
    fetchData.mockResolvedValue(mockData);

    const res = await request(app)
      .post('/v1/summary')
      .send({
        institucion: { nombre: 'Secretaría de Test', supplier_id: 'TEST' },
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('maneja errores de proveedores individuales', async () => {
    fetchData.mockResolvedValue({
      supplier_id: 'TEST',
      supplier_name: 'Test Provider',
      levels: ['ESTATAL'],
      error: 'Algo salió mal.',
      totalRows: 'No disponible',
    });

    const res = await request(app)
      .post('/v1/summary')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('error', 'Algo salió mal.');
  });

  it('incluye nombres, primerApellido, segundoApellido en la query', async () => {
    fetchData.mockResolvedValue({ supplier_id: 'TEST', supplier_name: 'Test Provider', levels: ['ESTATAL'], pagination: { page: 1, pageSize: 1, totalRows: 0, hasNextPage: false }, results: [] });

    await request(app)
      .post('/v1/summary')
      .send({ nombres: 'Juan', primerApellido: 'Pérez', segundoApellido: 'López' })
      .set('Content-Type', 'application/json');

    const callArg = fetchData.mock.calls[0][1];
    expect(callArg.query).toHaveProperty('nombres', 'Juan');
    expect(callArg.query).toHaveProperty('primerApellido', 'Pérez');
    expect(callArg.query).toHaveProperty('segundoApellido', 'López');
  });
});

describe('POST /v1/search', () => {
  beforeEach(() => {
    fetchData.mockReset();
  });

  it('responde error si no se proporciona supplier_id', async () => {
    const res = await request(app)
      .post('/v1/search')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Debe proporcionar un proveedor de información');
  });

  it('responde error si el supplier_id no existe', async () => {
    const res = await request(app)
      .post('/v1/search')
      .send({ supplier_id: 'NOEXISTE' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Proveedor de información no disponible');
  });

  it('busca con supplier_id válido y devuelve datos', async () => {
    const mockData = {
      supplier_id: 'TEST',
      supplier_name: 'Test Provider',
      levels: ['ESTATAL'],
      pagination: { page: 1, pageSize: 10, totalRows: 100, hasNextPage: true },
      results: [{ id: '1', nombres: 'Juan' }],
    };
    fetchData.mockResolvedValue(mockData);

    const res = await request(app)
      .post('/v1/search')
      .send({ supplier_id: 'TEST' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.supplier_id).toBe('TEST');
    expect(res.body.results[0].nombres).toBe('Juan');
  });

  it('envía query estructurada con params simples', async () => {
    fetchData.mockResolvedValue({ supplier_id: 'TEST', results: [] });

    await request(app)
      .post('/v1/search')
      .send({
        supplier_id: 'TEST',
        query: { nombres: 'Juan', primerApellido: 'Pérez' },
      })
      .set('Content-Type', 'application/json');

    const callArg = fetchData.mock.calls[0][1];
    expect(callArg.query).toHaveProperty('nombres', 'Juan');
    expect(callArg.query).toHaveProperty('primerApellido', 'Pérez');
  });

  it('envía query estructurada con datos de empleo', async () => {
    fetchData.mockResolvedValue({ supplier_id: 'TEST', results: [] });

    await request(app)
      .post('/v1/search')
      .send({
        supplier_id: 'TEST',
        query: {
          nombreEntePublico: 'Secretaría de Test',
          entidadFederativa: 'Zacatecas',
        },
      })
      .set('Content-Type', 'application/json');

    const callArg = fetchData.mock.calls[0][1];
    expect(callArg.query.datosEmpleoCargoComision).toHaveProperty('nombreEntePublico', 'Secretaría de Test');
    expect(callArg.query.datosEmpleoCargoComision).toHaveProperty('entidadFederativa', 'Zacatecas');
  });

  it('envía query con rangos', async () => {
    fetchData.mockResolvedValue({ supplier_id: 'TEST', results: [] });

    await request(app)
      .post('/v1/search')
      .send({
        supplier_id: 'TEST',
        query: {
          valorAdquisicionMin: '1000',
          valorAdquisicionMax: '50000',
        },
      })
      .set('Content-Type', 'application/json');

    const callArg = fetchData.mock.calls[0][1];
    expect(callArg.query.bienesInmuebles.valorAdquisicion).toHaveProperty('min', 1000);
    expect(callArg.query.bienesInmuebles.valorAdquisicion).toHaveProperty('max', 50000);
  });

  it('envía sort estructurado', async () => {
    fetchData.mockResolvedValue({ supplier_id: 'TEST', results: [] });

    await request(app)
      .post('/v1/search')
      .send({
        supplier_id: 'TEST',
        sort: { nombres: 'asc', primerApellido: 'desc' },
      })
      .set('Content-Type', 'application/json');

    const callArg = fetchData.mock.calls[0][1];
    expect(callArg.sort).toHaveProperty('nombres', 'asc');
    expect(callArg.sort).toHaveProperty('primerApellido', 'desc');
  });

  it('usa page y pageSize por defecto si no se envían', async () => {
    fetchData.mockResolvedValue({ supplier_id: 'TEST', results: [] });

    await request(app)
      .post('/v1/search')
      .send({ supplier_id: 'TEST' })
      .set('Content-Type', 'application/json');

    const callArg = fetchData.mock.calls[0][1];
    expect(callArg.page).toBe(1);
    expect(callArg.pageSize).toBe(10);
  });

  it('usa page y pageSize enviados', async () => {
    fetchData.mockResolvedValue({ supplier_id: 'TEST', results: [] });

    await request(app)
      .post('/v1/search')
      .send({ supplier_id: 'TEST', page: 3, pageSize: 25 })
      .set('Content-Type', 'application/json');

    const callArg = fetchData.mock.calls[0][1];
    expect(callArg.page).toBe(3);
    expect(callArg.pageSize).toBe(25);
  });
});

describe('POST /v1/logger', () => {
  it('recibe logs y responde ok', async () => {
    const res = await request(app)
      .post('/v1/logger')
      .send({ logs: [{ level: 'info', message: 'test log' }] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.msj).toBe('ok');
  });
});
