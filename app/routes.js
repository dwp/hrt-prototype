var express = require('express')
var router = express.Router()
var path = require('path')
var config = require(path.join(__dirname + '/config.js'))

// country register data based on the example from:
// https://openregister-picker-prototypes.herokuapp.com/location-picker-7
// https://github.com/openregister/picker-prototypes
// https://github.com/alphagov/accessible-typeahead
var locationServiceV1 = require('./services/location-v1')
var locationServiceV2 = require('./services/location-v2')
var locationServiceV3 = require('./services/location-v3')
var demoLocationService = require('./services/demo-location-v1')

// Route index page
router.get('/', function (req, res) {
  res.render('index')
})

router.use('*', (req,res,next) => {
  let locale = 'en-GB'
  res.locals.html_lang = 'en'
  res.locals.graph = locationServiceV3.locationGraph
  res.locals.locations = locationServiceV3.canonicalLocationList(locale)
  res.locals.reverseMap = locationServiceV3.locationReverseMap(locale)
  res.locals.locale = locale
  next()
})

router.all('/country-picker', function (req, res) {
  res.render('location-picker/index')
})

// include sub-application routing if enabled in the configuration file
if (config.useSubapplications) router.use('/', require(path.join(__dirname + '/subapps.js')))

module.exports = router
