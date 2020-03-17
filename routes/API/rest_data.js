const axios = require('axios');
const qs = require('qs');

const fetchEntities = endpoint => {
    return getToken(endpoint).then(response => {

        if (typeof response.error !== 'undefined'){
            return {error: true};
        }

        const {data} = response;
        const {access_token} = data;

        const opts = {
            url: endpoint.entities_url,
            method: 'GET',
            params: {
                access_token: access_token,
            },
            json: true
        };

        return axios(opts).then( response => {
            const entities = response.data;
            return entities.map(e => {
                e.supplier_id = endpoint.supplier_id;
                return e;
            });
        });
    });
};

const getToken = endpoint => {

    const opts = {
        url: endpoint.token_url,
        method: 'post',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': "Basic " + Buffer.from(`${endpoint.client_id}:${endpoint.client_secret}`).toString('base64')
        },
        data: qs.stringify({
            grant_type: 'password',
            username: endpoint.username,
            password: endpoint.password,
            client_id: endpoint.client_id,
            client_secret: endpoint.client_secret
        }),
        json: true
    };

    return axios(opts).catch(e => {
        console.log(e);
        return {error: true};
    });
};

const fetchData = (endpoint, options) => {
    return getToken(endpoint).then(response => {

        if (typeof response.error !== 'undefined'){
            return {error: true};
        }

        const {data} = response;
        const {access_token} = data;

        let opts = {
            url: endpoint.url,
            method: 'post',
            params: {
                access_token: access_token
            },
            data: options,
            json: true
        };

        //console.log(opts);

        return axios(opts).then( request => {
            let {data} = request;
            data.supplier_name = endpoint.supplier_name;
            data.supplier_id = endpoint.supplier_id;
            data.levels = endpoint.levels;
            data.endpoint_type = endpoint.type;
            return data;
        }).catch(e => {
            console.log(e);
            return {error: true};
        });
    });
};

module.exports = {
    fetchData,
    fetchEntities
};