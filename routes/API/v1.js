var express = require('express');
const cors = require('cors');
const {fetchData} = require('./rest_data');

var router = express.Router();
router.use(cors());

router.get('/', (req, res) => {

    res.json({});
});


router.post('/summary', (req, res) => {

   res.json({});
});

router.post('/search', (req, res) => {

    res.json({});
});

module.exports = router;