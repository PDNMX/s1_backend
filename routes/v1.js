var express = require('express');
const cors = require('cors');
const qs = require('qs');
const { fetchData } = require('./rest_data');
const endpoints = require('../endpoints');

const log4js = require('log4js');
var logger = log4js.getLogger('v1.js');
logger.level = 'all';

var router = express.Router();
router.use(cors());

router.get('/', (req, res) => {
	logger.info("It's live!!!");

	res.json({
		title: 'API del Sistema 1',
		version: '1.0'
	});
});

router.get('/v1/providers', (req, res) => {
	res.json(
		endpoints.map((p) => {
			return {
				supplier_id: p.supplier_id,
				supplier_name: p.supplier_name,
				levels: p.levels
			};
		})
	);
});

router.post('/v1/summary', (req, res) => {
	const { body } = req;
	const { nivel_gobierno, institucion } = body;

	let options = {
		page: 1,
		pageSize: 1,
		query: {}
	};

	const params = [ 'nombres', 'primerApellido', 'segundoApellido' ];

	for (let k of params) {
		if (body.hasOwnProperty(k) && typeof body[k] !== 'undefined' && body[k] !== null && body[k] !== '') {
			options.query[k] = body[k];
		}
	}

	let endpoints_;

	if (typeof institucion !== 'undefined' && typeof institucion === 'object') {
		const { nombre, supplier_id } = institucion;
		options.query.institucionDependencia = nombre;
		endpoints_ = endpoints.filter((e) => e.supplier_id === supplier_id);
	} else if (typeof nivel_gobierno !== 'undefined' && nivel_gobierno !== null && nivel_gobierno !== '') {
		endpoints_ = endpoints.filter((e) => e.levels.includes(nivel_gobierno));
	} else {
		endpoints_ = endpoints;
	}

	let queries = endpoints_.map((endpoint) => {
		let options_ = JSON.parse(JSON.stringify(options));
		return fetchData(endpoint, options_).catch((error) => {
			logger.error(error);
			return {
				supplier_id: endpoint.supplier_id,
				supplier_name: endpoint.supplier_name,
				levels: endpoint.levels,
				error: 'Algo salió mal.',
				totalRows: 'No disponible'
			};
		});
	});

	Promise.all(queries)
		.then((responses) => {
			let summary = responses.map((data) => {
				if (typeof data.error !== 'undefined') {
					return data;
				} else {
					return {
						supplier_id: data.supplier_id,
						supplier_name: data.supplier_name,
						levels: data.levels,
						pagination: data.pagination,
						results: data.results
					};
				}
			});
			res.json(summary);
		})
		.catch((error) => {
			logger.error(error);
			res.status(500).json({
				error: 'Algo salio mal...'
			});
		});
});

function createQuery(req, res, next) {
	let { query, supplier_id } = req.body;
	let _query = {};

	if (typeof query === 'undefined' || query === null || Object.entries(query).length === 0) {
		next();
		return;
	}

	const params = [ 'id', 'nombres', 'primerApellido', 'segundoApellido', 'escolaridadNivel', 'formaAdquisicion' ];

	const empleo = [
		'nombreEntePublico',
		'entidadFederativa',
		'municipioAlcaldia',
		'empleoCargoComision',
		'nivelOrdenGobierno',
		'nivelEmpleoCargoComision'
	];

	const rangos = [ 'superficieConstruccion', 'superficieTerreno', 'valorAdquisicion', 'totalIngresosNetos' ];

	logger.info(supplier_id, '|search query|', JSON.stringify(query));

	params.forEach((p) => {
		if (typeof query[p] !== 'undefined' && query[p] !== null && query[p] !== '0' && query[p].length > 0) {
			if (p === 'formaAdquisicion') {
				_query['bienesInmuebles'] = {
					..._query['bienesInmuebles'],
					formaAdquisicion: query[p]
				};
			} else {
				_query[p] = query[p];
			}
		}
	});

	empleo.forEach((p) => {
		if (typeof query[p] !== 'undefined' && query[p] !== null && query[p] !== '0' && query[p].length > 0) {
			_query['datosEmpleoCargoComision'] = {
				..._query['datosEmpleoCargoComision'],
				[p]: query[p]
			};
		}
	});

	rangos.forEach((r) => {
		let temp = null;
		let min = query[r + 'Min'];
		let max = query[r + 'Max'];

		if (typeof min !== 'undefined' && min !== null && !isNaN(min) && min !== '') {
			temp = { ...temp, min: Number(min) };
		}

		if (typeof max !== 'undefined' && max !== null && !isNaN(max) && min !== '') {
			temp = { ...temp, max: Number(max) };
		}

		if (temp !== null) {
			if (r === 'totalIngresosNetos') {
				_query[r] = temp;
			} else {
				_query['bienesInmuebles'] = { ..._query['bienesInmuebles'], [r]: temp };
			}
		}
	});

	req.body.query = _query;

	next();
}

function createOrder(req, res, next) {
	let { sort, supplier_id } = req.body;
	let _sort = {};
	let datosEmpleoCargoComision = {};
	let bienesInmuebles = {};

	if (typeof sort === 'undefined' || sort === null || Object.entries(sort).length === 0) {
		next();
		return;
	}

	logger.info(supplier_id, '|sort|', sort);

	const params = [ 'nombres', 'primerApellido', 'segundoApellido', 'escolaridadNivel', 'totalIngresosNetos' ];
	const empleo = [
		'nombreEntePublico',
		'entidadFederativa',
		'municipioAlcaldia',
		'empleoCargoComision',
		'nivelEmpleoCargoComision',
		'nivelOrdenGobierno'
	];

	const inmuebles = [ 'superficieConstruccion', 'superficieTerreno', 'formaAdquisicion', 'valorAdquisicion' ];

	params.forEach((p) => {
		if (typeof sort[p] !== 'undefined') _sort[p] = sort[p];
	});

	empleo.forEach((e) => {
		if (
			typeof sort[e] !== 'undefined' //datosEmpleoCargoComision[e] = sort[e];
		)
			_sort['datosEmpleoCargoComision'] = {
				..._sort['datosEmpleoCargoComision'],
				[e]: sort[e]
			};
	});

	inmuebles.forEach((i) => {
		if (
			typeof sort[i] !== 'undefined' //bienesInmuebles[i] = sort[i];
		)
			_sort['bienesInmuebles'] = {
				..._sort['bienesInmuebles'],
				[i]: sort[i]
			};
	});

	req.body.sort = _sort;
	next();
}

router.post('/v1/search', createQuery, createOrder, (req, res) => {
	let { query, supplier_id, institucion, page, pageSize, sort } = req.body;

	logger.info(supplier_id, '|query|', query);
	logger.info(supplier_id, '|sort final|', sort);

	if (typeof page === 'undefined' || page === null || isNaN(page)) {
		page = 1;
	}

	if (typeof pageSize === 'undefined' || pageSize === null || isNaN(pageSize)) {
		pageSize = 10;
	}

	if (typeof supplier_id === 'undefined') {
		res.status(500).json({
			error: 'Debe proporcionar un proveedor de información'
		});
		return;
	}

	let endpoint = endpoints.find((d) => d.supplier_id === supplier_id);

	if (typeof endpoint === 'undefined') {
		res.status(500).json({
			error: 'Proveedor de información no disponible'
		});
		return;
	}

	let options = {
		page,
		pageSize,
		query,
		sort
	};

	logger.info(supplier_id, '|query final|', options);

	fetchData(endpoint, options)
		.then((data) => {
			res.json(data);
		})
		.catch((error) => {
			logger.error(error);
			res.status(500).json({ error: { status, statusText, data } });
		});
});

router.post('/v1/logger', (req, res) => {
	let logs = req.body.logs;

	logs.forEach((log) => {
		switch (log.level) {
			case 'error':
				logger.error(log);
				break;
			case 'info':
				logger.info(log);
				break;

			default:
				logger.info(log);
				break;
		}
	});

	res.json({ msj: 'ok' });
});

module.exports = router;
