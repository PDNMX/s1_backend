const rp = require('request-promise');

/*
const fetchEntities = endpoint => {
    return getToken(endpoint).then(token_data => {
        const {access_token} = token_data;
        const opts = {
            uri: endpoint.entities_url,
            method: 'GET',
            qs: {
                access_token: access_token,
            },
            json: true
        };

        return rp(opts).then( entities => {
            return entities.map(e => {
                e.supplier_id = endpoint.supplier_id;
                return e;
            });
        });
    });
};
*/

const fetchData = (endpoint, options) => {
    return getToken(endpoint).then(token_data => {
        const {access_token} = token_data;

        let opts = {
            uri: endpoint.url,
            method: 'POST',
            qs: {
                access_token: access_token
            },
            body: options,
            json: true
        };

        console.log(opts.body);
        return rp(opts).then( data => {
            data.supplier_name = endpoint.supplier_name;
            data.supplier_id = endpoint.supplier_id;
            data.levels = endpoint.levels;
            data.endpoint_type = endpoint.type;
            return data;
        });
    });
};

const getToken = endpoint => {
    const opts = {
        uri: endpoint.token_url,
        method: 'POST',
        contentType: 'x-www-form-urlencoded',
        form: {
            grant_type: 'password',
            username: endpoint.username,
            password: endpoint.password,
            client_id: endpoint.client_id,
            client_secret: endpoint.client_secret
        },
        json: true
    };

    return rp(opts);
};

module.exports = {
    fetchData,
    //fetchEntities
};