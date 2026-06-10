jest.mock('axios');

const axios = require('axios');
const https = require('https');

const mockAxiosInstance = jest.fn();
mockAxiosInstance.post = jest.fn();
mockAxiosInstance.get = jest.fn();
mockAxiosInstance.request = jest.fn();

axios.create.mockReturnValue(mockAxiosInstance);

const { fetchData, fetchEntities } = require('../routes/rest_data');

const testEndpoint = {
  supplier_id: 'TEST',
  supplier_name: 'Test Provider',
  type: 'REST',
  levels: ['ESTATAL'],
  url: 'https://test.example.com/api',
  entities_url: 'https://test.example.com/entities',
  token_url: 'https://test.example.com/auth',
  username: 'test_user',
  password: 'test_pass',
  client_id: 'test_client',
  client_secret: 'test_secret',
  scope: 'read',
  method: 'body',
};

describe('fetchData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('obtiene token y luego datos exitosamente', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'test_token_123' },
    });

    const apiResponse = {
      data: {
        supplier_id: 'TEST',
        pagination: { page: 1, pageSize: 10, totalRows: 50, hasNextPage: true },
        results: [{ id: '1', nombres: 'Juan' }],
      },
    };
    mockAxiosInstance.mockResolvedValueOnce(apiResponse);

    const result = await fetchData(testEndpoint, { page: 1, pageSize: 10 });

    const postCallArgs = mockAxiosInstance.post.mock.calls[0];
    const postUrl = postCallArgs[0];
    const postData = postCallArgs[1];
    const postOpts = postCallArgs[2];

    expect(postUrl).toBe(testEndpoint.token_url);
    expect(postData).toContain('client_id=' + testEndpoint.client_id);
    expect(postData).toContain('client_secret=' + testEndpoint.client_secret);
    expect(postData).toContain('grant_type=password');
    expect(postOpts).not.toHaveProperty('auth');

    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        url: testEndpoint.url,
        method: 'post',
        headers: expect.objectContaining({
          Authorization: 'Bearer test_token_123',
        }),
        data: { page: 1, pageSize: 10 },
      })
    );

    expect(result.supplier_id).toBe('TEST');
    expect(result.supplier_name).toBe('Test Provider');
    expect(result.levels).toEqual(['ESTATAL']);
  });

  it('maneja error en getToken', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce({
      response: { status: 401, statusText: 'Unauthorized', data: 'Invalid credentials' },
    });

    const result = await fetchData(testEndpoint, { page: 1, pageSize: 10 });

    expect(result.error).toBeDefined();
  });

  it('maneja error en la llamada a datos', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'test_token' },
    });

    mockAxiosInstance.mockRejectedValueOnce({
      response: { status: 500, statusText: 'Internal Server Error' },
    });

    const result = await fetchData(testEndpoint, { page: 1, pageSize: 10 });

    expect(result.error).toBeDefined();
    expect(result.error.status).toBe(500);
  });

  it('maneja error de red (sin response)', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'test_token' },
    });

    mockAxiosInstance.mockRejectedValueOnce({
      errno: 'ECONNREFUSED',
      code: 'ECONNREFUSED',
    });

    const result = await fetchData(testEndpoint, { page: 1, pageSize: 10 });

    expect(result.error).toBeDefined();
    expect(result.error.status).toBe('ECONNREFUSED');
  });

  it('incluye supplier_name y supplier_id en la respuesta', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'token' },
    });

    mockAxiosInstance.mockResolvedValueOnce({
      data: {
        pagination: { page: 1, pageSize: 10, totalRows: 0, hasNextPage: false },
        results: [],
      },
    });

    const result = await fetchData(testEndpoint, { page: 1, pageSize: 10 });

    expect(result.supplier_name).toBe('Test Provider');
    expect(result.supplier_id).toBe('TEST');
    expect(result.levels).toEqual(['ESTATAL']);
    expect(result.endpoint_type).toBe('REST');
  });

  it('envía client_id/client_secret por body cuando method es body (default)', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'token_body' },
    });
    mockAxiosInstance.mockResolvedValueOnce({
      data: { pagination: { page: 1, pageSize: 10, totalRows: 0, hasNextPage: false }, results: [] },
    });

    await fetchData(testEndpoint, { page: 1, pageSize: 10 });

    const [url, body, opts] = mockAxiosInstance.post.mock.calls[0];
    expect(body).toContain('client_id=' + testEndpoint.client_id);
    expect(body).toContain('client_secret=' + testEndpoint.client_secret);
    expect(opts).not.toHaveProperty('auth');
  });

  it('envía client_id/client_secret por header cuando method es header', async () => {
    const headerEndpoint = { ...testEndpoint, method: 'header' };

    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'token_header' },
    });
    mockAxiosInstance.mockResolvedValueOnce({
      data: { pagination: { page: 1, pageSize: 10, totalRows: 0, hasNextPage: false }, results: [] },
    });

    await fetchData(headerEndpoint, { page: 1, pageSize: 10 });

    const [url, body, opts] = mockAxiosInstance.post.mock.calls[0];
    expect(body).not.toContain('client_id');
    expect(body).not.toContain('client_secret');
    expect(opts.auth).toEqual({
      username: testEndpoint.client_id,
      password: testEndpoint.client_secret,
    });
  });

  it('detecta código de error en la respuesta de datos', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'token' },
    });

    mockAxiosInstance.mockResolvedValueOnce({
      data: { code: 'ERROR_001', message: 'Something went wrong' },
    });

    const result = await fetchData(testEndpoint, { page: 1, pageSize: 10 });

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('ERROR_001');
    expect(result.error.message).toBe('Something went wrong');
  });
});

describe('fetchEntities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('obtiene token y luego entidades exitosamente con method body', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'entity_token' },
    });

    const entitiesData = [
      { id: 'ent1', name: 'Entity 1' },
      { id: 'ent2', name: 'Entity 2' },
    ];
    mockAxiosInstance.mockResolvedValueOnce({
      data: entitiesData,
    });

    const result = await fetchEntities(testEndpoint);

    const postOpts = mockAxiosInstance.post.mock.calls[0][2];
    expect(postOpts).not.toHaveProperty('auth');

    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        url: testEndpoint.entities_url,
        method: 'GET',
        params: { access_token: 'entity_token' },
      })
    );

    expect(result.length).toBe(2);
    expect(result[0].supplier_id).toBe('TEST');
    expect(result[0].id).toBe('ent1');
  });

  it('obtiene token y luego entidades exitosamente con method header', async () => {
    const headerEndpoint = { ...testEndpoint, method: 'header' };

    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { access_token: 'entity_token_header' },
    });

    const entitiesData = [
      { id: 'entA', name: 'Entity A' },
    ];
    mockAxiosInstance.mockResolvedValueOnce({
      data: entitiesData,
    });

    const result = await fetchEntities(headerEndpoint);

    const [url, body, opts] = mockAxiosInstance.post.mock.calls[0];
    expect(body).not.toContain('client_id');
    expect(opts.auth).toEqual({
      username: testEndpoint.client_id,
      password: testEndpoint.client_secret,
    });

    expect(result.length).toBe(1);
    expect(result[0].supplier_id).toBe('TEST');
  });

  it('devuelve error si getToken falla', async () => {
    mockAxiosInstance.post.mockRejectedValueOnce({
      response: { status: 401, statusText: 'Unauthorized' },
    });

    const result = await fetchEntities(testEndpoint);

    expect(result.error).toBe(true);
  });
});
