var express = require('express');
const cors = require('cors');
const {fetchData} = require('./rest_data');
const endpoints = require('../../endpoints');

var router = express.Router();
router.use(cors());

router.get('/', (req, res) => {
    res.json({
        "title": "API del Sistema 1",
        "version": '1.0'
    });
});

router.post('/summary', (req, res) => {

    const { body } = req;
    const { nivel_gobierno, institucion } = body;

    let options = {
        page: 1,
        pageSize: 1,
        query : {}
    };

    const params = [
        'nombres',
        'primerApellido',
        'segundoApellido'
    ];

    for (let k of params){
        if (body.hasOwnProperty(k) && typeof body[k] !== 'undefined' && body[k] !== null && body[k] !== '') {
            options.query[k] = body[k];
        }
    }

    let endpoints_;

    if (typeof institucion !== "undefined" && typeof institucion === "object"){
        const { nombre, supplier_id } = institucion;
        options.query.institucionDependencia = nombre;
        endpoints_ = endpoints.filter(e => e.supplier_id === supplier_id );
    } else if (typeof nivel_gobierno !== 'undefined'&& nivel_gobierno !== null && nivel_gobierno !== ''){
        endpoints_ = endpoints.filter(e => e.levels.includes(nivel_gobierno));
    } else {
        endpoints_ = endpoints;
    }

    let queries = endpoints_.map(endpoint => {
        let options_ = JSON.parse(JSON.stringify(options));
        return fetchData(endpoint, options_).catch(error => {
            console.log(error);
            return {
                supplier_id: endpoint.supplier_id,
                supplier_name: endpoint.supplier_name,
                levels: endpoint.levels,
                error: "Algo salió mal.",
                totalRows: "No disponible"
            }
        });
    });

    Promise.all(queries).then( responses => {
        //console.log(data);
        let summary = responses.map (data => {
            if (typeof data.error !== 'undefined'){
                return data;
            } else {
                return {
                    supplier_id: data.supplier_id,
                    supplier_name: data.supplier_name,
                    levels: data.levels,
                    totalRows: data.pagination.totalRows
                }
            }
        });

        res.json(summary);
    }).catch(error => {
        console.log(error);
        res.status(500).json({
            error: "Algo salio mal..."
        });
    });

});

router.post('/search', (req, res) => {
    res.json({});
});

module.exports = router;