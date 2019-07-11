var express = require('express');
var path = require('path');
var app = express();
var fs = require("fs");
var bodyParser=require('body-parser')
var customlib=require ('./dao/data')

//Variable initialization

// set the view engine to ejs
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.set('view engine', 'ejs');

// use res.render to load up an ejs view file
app.get('/requisitions', function(req, res) {
	
    //res.render('index',{groups:groups});
    customlib.requisitions(function (allRequisitions)
    {
		console.log("Returned the list of all requisitions...");
		res.send(allRequisitions);
	});
});
app.get('/requisitionbyid/:uuid', function(req, res) {
	
    //res.render('index',{groups:groups});
    requisitionId=req.params.uuid;
    console.log("requisitionId :"+requisitionId);
    customlib.requisitionsbyId(requisitionId,function (oRequisition)
    {
		console.log("Returned the list of the requisition");
		res.send(oRequisition);
	});
});
app.listen(8001);
console.log('App running on port 8001');
