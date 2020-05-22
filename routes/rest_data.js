const axios = require("axios");
const qs = require("qs");

const log4js = require("log4js");
var logger = log4js.getLogger("rest_data.js");
logger.level = "all";

const fetchEntities = (endpoint) => {
  return getToken(endpoint).then((response) => {
    if (typeof response.error !== "undefined") {
      return { error: true };
    }

    const { data } = response;
    const { access_token } = data;

    const opts = {
      url: endpoint.entities_url,
      method: "GET",
      params: {
        access_token: access_token,
      },
      json: true,
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

const getToken = (endpoint) => {
  let data = {
    grant_type: "password",
    username: endpoint.username,
    password: endpoint.password,
  };
  if (endpoint.scope !== "") {
    data.scope = endpoint.scope;
  }

  const opts = {
    url: endpoint.token_url,
    method: "post",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${endpoint.client_id}:${endpoint.client_secret}`).toString(
          "base64"
        ),
    },
    data: qs.stringify(data),
    json: true,
  };

  return axios(opts).catch((e) => {
    return { error: e.response };
  });
};

const fetchData = (endpoint, options) => {
  return getToken(endpoint).then((response) => {
    if (typeof response.error !== "undefined") {
      let { status, statusText, data } = response.error;

      logger.error("status:" + status);
      logger.error("statusText:" + statusText);
      logger.error("data:" + data);

      return { error: { status, statusText, data } };
    }

    const { access_token } = response.data;

    let opts = {
      url: endpoint.url,
      method: "post",
      headers: {
        Authorization: "Bearer " + access_token,
      },
      data: options,
      json: true,
    };

    return axios(opts)
      .then((request) => {
        let { data } = request;

        data.supplier_name = endpoint.supplier_name;
        data.supplier_id = endpoint.supplier_id;
        data.levels = endpoint.levels;
        data.endpoint_type = endpoint.type;

        if (typeof data.code !== "undefined") {
          return {
            supplier_name: endpoint.supplier_name,
            supplier_id: endpoint.supplier_id,
            levels: endpoint.levels,
            endpoint_type: endpoint.type,
            error: {
              code: data.code,
              message: data.message,
            },
          };
        }

        return data;
      })
      .catch((e) => {
        logger.error(e);
        return { error: true };
      });
  });
};

module.exports = {
  fetchData,
  fetchEntities,
};
