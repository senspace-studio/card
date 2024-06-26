"use strict";
exports.__esModule = true;
exports.tweClientPure = void 0;
var openapi_fetch_1 = require("openapi-fetch");
// import { THIRDWEB_ENGINE_ENDPOINT } from 'src/utils/env';
var axios_1 = require("axios");
var THIRDWEB_ENGINE_ENDPOINT = process.env.THIRDWEB_ENGINE_ENDPOINT || '';
var THIRDWEB_ENGINE_ACCESS_TOKEN = process.env.THIRDWEB_ENGINE_ACCESS_TOKEN || '';
var tweClient = openapi_fetch_1["default"]({
    baseUrl: THIRDWEB_ENGINE_ENDPOINT,
    headers: {
        authorization: "Bearer " + THIRDWEB_ENGINE_ACCESS_TOKEN
    }
});
exports.tweClientPure = axios_1["default"].create({
    baseURL: THIRDWEB_ENGINE_ENDPOINT,
    headers: {
        authorization: "Bearer " + THIRDWEB_ENGINE_ACCESS_TOKEN
    }
});
exports["default"] = tweClient;
