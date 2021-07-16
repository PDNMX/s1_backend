const axiosp = require('axios');
const https = require('https');
const qs = require('qs');

const axios = axiosp.create({
	httpsAgent: new https.Agent({
		rejectUnauthorized: false
	})
});

const log4js = require('log4js');
var logger = log4js.getLogger('rest_data.js');
logger.level = 'all';

const fetchEntities = (endpoint) => {
	return getToken(endpoint).then((response) => {
		if (typeof response.error !== 'undefined') {
			return { error: true };
		}

		const { data } = response;
		const { access_token } = data;

		const opts = {
			url: endpoint.entities_url,
			method: 'GET',
			params: {
				access_token: access_token
			},
			json: true
		};

		return axios(opts).then((response) => {
			const entities = response.data;
			return entities.map((e) => {
				e.supplier_id = endpoint.supplier_id;
				return e;
			});
		});
	});
};

const getToken = ({ username, password, scope, token_url, client_id, client_secret }) => {

	let data = {
		grant_type: 'password',
		username: username,
		password: password,
		client_id: client_id,
		client_secret: client_secret
	};
	if (scope !== '') {
		data.scope = scope;
	}

	const opts = {
		auth: {
			username: client_id,
			password: client_secret
		},
		responseType: 'json',
		json: true
	};

	return axios
		.post(token_url, qs.stringify(data), opts)
		.then((res) => {
			return res;
		})
		.catch((err) => {
			console.log(err.response.data);
			return err;
		});
};

const fetchData = (endpoint, options) => {
	let { supplier_id } = endpoint;
	return getToken(endpoint)
		.then((response) => {
			if (typeof response.error !== 'undefined') {
				logger.info(supplier_id, 'paso por aqui...');
				let { status, statusText, data } = response.error;

				logger.error(supplier_id, 'status:' + status);
				logger.error(supplier_id, 'statusText:' + statusText);
				logger.error(supplier_id, 'data:' + data);

				return { error: { status, statusText, data } };
			}

			const { access_token } = response.data;

			let opts = {
				url: endpoint.url,
				method: 'post',
				headers: {
					Authorization: 'Bearer ' + access_token
				},
				data: options,
				json: true
			};

			return axios(opts)
				.then((request) => {
					let { data } = request;

					data.supplier_name = endpoint.supplier_name;
					data.supplier_id = endpoint.supplier_id;
					data.levels = endpoint.levels;
					data.endpoint_type = endpoint.type;

					if (typeof data.code !== 'undefined') {
						return {
							supplier_name: endpoint.supplier_name,
							supplier_id: endpoint.supplier_id,
							levels: endpoint.levels,
							endpoint_type: endpoint.type,
							error: {
								code: data.code,
								message: data.message
							}
						};
					}

					return data;
				})
				.catch((e) => {
					let error =
						typeof e.response === 'undefined'
							? { error: { status: e.errno, statusText: e.code } }
							: {
								error: {
									status: e.response.status,
									statusText: e.response.statusText,
									data: e.response.data
								}
							};

					logger.error(supplier_id, error);
					delete error.error.data;
					return error;
				});
		})
		.catch((e) => {
			let error =
				typeof e.response === 'undefined'
					? { error: { status: e.errno, statusText: e.code } }
					: {
						error: { status: e.response.status, statusText: e.response.statusText, data: e.response.data }
					};

			logger.error(supplier_id, error);
			delete error.error.data;
			return error;
		});
};

module.exports = {
	fetchData,
	fetchEntities
};
