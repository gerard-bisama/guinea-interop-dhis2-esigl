#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const winston = require('winston')
const customLibrairy=require('./lib.js');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const utils = require('./utils')

// Logging setup
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {level: 'info', timestamp: true, colorize: true})

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = process.env.NODE_ENV === 'test' ? require('../config/test') : require('../config/config')
const mediatorConfig = require('../config/mediator')

var port = process.env.NODE_ENV === 'test' ? 7002 : mediatorConfig.endpoints[0].port

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
 function errorHandler(err, req, res, next) {
		  if (res.headersSent) {
			return next(err);
		  }
		  res.status(500);
		  res.render('error', { error: err });
	}


function setupApp () {
	
  const app = express()
  app.use(errorHandler);
  //
  var async = require('async');
  var btoa = require('btoa');
  
    
	app.get('/product2dhsi2', (req, res) => {
		var needle = require('needle');
		needle.defaults(
		{
			open_timeout: 600000
		});
		//console.log("Entered ....!");
		console.log("Start hapi=>dhis2 products sync...!");
		const basicClientToken = `Basic ${btoa(mediatorConfig.config.dhis2Server.username+':'+mediatorConfig.config.dhis2Server.password)}`;
		//Get Product list from hapi
		var globalStoredList=[];
		//getAllProducts("",globalStoredList,function(productLists)
		getAllProductsCurl("",globalStoredList,function(productLists)
		{
			winston.info("Product resources returned from Fhir..");
			//console.log(JSON.stringify(productLists[));
			//console.log(productLists.length);
			//return;
			var orchestrationsProducts2Push=[];
			//productLists[0].extension[0].extension[0].url
			
			//first create product as categoryOptions
			for(var iteratorOrch=0;iteratorOrch<productLists.length;iteratorOrch++)
			//for(var iteratorOrch=0;iteratorOrch<2;iteratorOrch++)
			{
				var oProduct=productLists[iteratorOrch];
				var codeProduct=oProduct.id;
				var productName=customLibrairy.getProductName(oProduct);
				var productPayLoad={
					code:oProduct.id,
					name:productName,
					shortName:productName.substr(50),
					displayName:productName
					}
				orchestrationsProducts2Push.push(
					{ 
					ctxObjectRef: codeProduct,
					name: codeProduct, 
					domain: mediatorConfig.config.dhis2Server.url,
					path:mediatorConfig.config.dhis2Server.apiPath+"/categoryOptions",
					params: "",
					body:  JSON.stringify(productPayLoad),
					method: "POST",
					headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
				
			}
			var asyncProduct2Push = require('async');
			var ctxObject2Update = []; 
			var orchestrationsResultsProducts=[];
			var counterPush=1;
			
			asyncProduct2Push.each(orchestrationsProducts2Push, function(orchestrationProduct, callbackProduct) {
				var orchUrl = orchestrationProduct.domain + orchestrationProduct.path + orchestrationProduct.params;
				var options={
					headers:orchestrationProduct.headers
					};
				var product2Push=orchestrationProduct.body;
				//console.log(orchUrl);
				needle.post(orchUrl,product2Push,options, function(err, resp) {
					// if error occured
					
					if ( err ){
						winston.error("Needle: error when pushing product data to dhis2");
						callbackProduct(err);
					}
					//console.log(resp);
					console.log("********************************************************");
					winston.info(counterPush+"/"+orchestrationsProducts2Push.length);
					winston.info("...Inserting "+orchestrationProduct.path);
					orchestrationsResultsProducts.push({
					name: orchestrationProduct.name,
					request: {
					  path : orchestrationProduct.path,
					  headers: orchestrationProduct.headers,
					  querystring: orchestrationProduct.params,
					  body: orchestrationProduct.body,
					  method: orchestrationProduct.method,
					  timestamp: new Date().getTime()
					},
					response: {
					  status: resp.statusCode,
					  //body: JSON.stringify(resp.body.toString('utf8'), null, 4),
					  body: resp.body,
					  timestamp: new Date().getTime()
					}
					});
					//console.log(resp.body);
					// add orchestration response to context object and return callback
					ctxObject2Update[orchestrationProduct.ctxObjectRef] = resp.body;
					counterPush++;
					callbackProduct();
				});
			},function(err)
			{
				if(err)
				{
					winston.error(err);
				}
				winston.info("Creation of product => categoryOptions done!")
				//console.log(orchestrationsResultsProducts[0].response.body);
				//Now check the responses, if created push catogoryOptions into the product  Categorie
				var listProductIdCreated=[];
				for(var iteratorResp=0;iteratorResp<orchestrationsResultsProducts.length;iteratorResp++)
				{
					var operationResponse=orchestrationsResultsProducts[iteratorResp].response;
					var productCode=orchestrationsResultsProducts[iteratorResp].name;
					//console.log(JSON.stringify(operationResponse));
					if(operationResponse.body.httpStatus=="Created")
					{
						listProductIdCreated.push(operationResponse.body.response.uid);
						winston.info("Product: "+productCode+" created with id = "+operationResponse.body.response.uid);
					}
					else if(operationResponse.body.httpStatus=="Conflict")
					{
						if(operationResponse.body.response.errorReports.length>0)
						{
							var resourceId=operationResponse.body.response.errorReports[0].mainId;
							listProductIdCreated.push(resourceId);
						}
					}
					else
					{
						winston.warn("Failed to create Product: "+productCode);
					}
				}
				//If id product created assign them to the product category
				if(listProductIdCreated.length>0)
				{
					var ochestrationProductCollection=[];
					/*
					for(var iteratorCol=0;iteratorCol<listProductIdCreated.length;iteratorCol++)
					{
						ochestrationProductCollection.push(
						{ 
							ctxObjectRef: listProductIdCreated[iteratorCol],
							name: listProductIdCreated[iteratorCol], 
							domain: mediatorConfig.config.dhis2Server.url,
							path:mediatorConfig.config.dhis2Server.apiPath+"/categories/"+mediatorConfig.config.productCategoryId+"/categoryOptions/"+listProductIdCreated[iteratorCol],
							params: "",
							body:  "",
							method: "POST",
							headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
					  });
					}//end of for
					*/
					//Building the identifiable Ojects payload
					var identifiablePayload={
						identifiableObjects:[]
						};
					for(var iteratorCol=0;iteratorCol<listProductIdCreated.length;iteratorCol++)
					{
						identifiablePayload.identifiableObjects.push(
							{
								id:listProductIdCreated[iteratorCol]
							}
						);
					}
					ochestrationProductCollection.push(
					{ 
						ctxObjectRef: "productsCollection",
						name: "productsCollection", 
						domain: mediatorConfig.config.dhis2Server.url,
						path:mediatorConfig.config.dhis2Server.apiPath+"/categories/"+mediatorConfig.config.productCategoryId+"/categoryOptions",
						params: "",
						body:  JSON.stringify(identifiablePayload),
						method: "POST",
						headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
					var asyncProductCollection = require('async');
					var ctxObject2Update = []; 
					var orchestrationsResultsCollections=[];
					var counterCollection=1;
					
					asyncProductCollection.each(ochestrationProductCollection, function(orchestrationCollection, callbackCollection) {
						var orchUrl = orchestrationCollection.domain + orchestrationCollection.path + orchestrationCollection.params;
						var options={
							headers:orchestrationCollection.headers
							};
						var dataToPush=orchestrationCollection.body;
							needle.post(orchUrl,dataToPush,options, function(err, resp) {
								if ( err ){
									winston.error("Needle: error when pushing product data to the collection to dhis2");
									callbackProduct(err);
								}
								console.log("********************************************************");
								winston.info(counterCollection+"/"+ochestrationProductCollection.length);
								winston.info("...Inserting "+orchestrationCollection.path);
								orchestrationsResultsCollections.push({
								name: orchestrationCollection.name,
								request: {
								  path : orchestrationCollection.path,
								  headers: orchestrationCollection.headers,
								  querystring: orchestrationCollection.params,
								  body: orchestrationCollection.body,
								  method: orchestrationCollection.method,
								  timestamp: new Date().getTime()
								},
								response: {
								  status: resp.statusCode,
								  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
								  //body: resp.body,
								  timestamp: new Date().getTime()
								}
								});
								ctxObject2Update.push({ref:orchestrationCollection.name,log:resp.body});
								counterCollection++;
								callbackCollection();
							});//end of needle
							
						},function(err)
						{
							if(err)
							{
								winston.error(err);
							}
							winston.info("Assign of products => Category done!");
							console.log(orchestrationsResultsCollections[0].response);
							
							for(var iteratorResp=0;iteratorResp<orchestrationsResultsCollections.length;iteratorResp++)
							{
								//console.log(orchestrationsResultsCollections[iteratorResp].response);
								if(orchestrationsResultsCollections[iteratorResp].response.status>=200 && orchestrationsResultsCollections[iteratorResp].response.status<300)
								{
									winston.info("Assignment to the collection done for categoryOption ");
									
								}
								else
								{
									
									winston.warn("Assignment to the collection failed for categoryOption ");
									//console.log(ctxObject2Update);
								}
							}
							var urn = mediatorConfig.urn;
							var status = 'Successful';
							var response = {
							  status: 200,
							  headers: {
								'content-type': 'application/json'
							  },
							  body:JSON.stringify( {'OperationResult':'Product synched successfully into dhis2'}),
							  timestamp: new Date().getTime()
							};
							var properties = {};
							properties['Number product pushed'] =listProductIdCreated.length;
							var returnObject = {
							  "x-mediator-urn": urn,
							  "status": status,
							  "response": response,
							  "orchestrations": orchestrationsResultsCollections,
							  "properties": properties
							}
							winston.info("End of Hapi=>DHIS2 produit orchestration");
							res.set('Content-Type', 'application/json+openhim');
							res.send(returnObject);
							
						});//end of asyncProductCollection.each 
				}
				else
				{
					winston.warn("No product to assign to the category");
					var urn = mediatorConfig.urn;
					var status = 'Successful';
					var response = {
					  status: 200,
					  headers: {
						'content-type': 'application/json'
					  },
					  body:JSON.stringify( {'OperationResult':'No product to assign to the category'}),
					  timestamp: new Date().getTime()
					};
					var properties = {};
					properties['Numner product pushed'] =0;
					var orchestrationToReturn=[
					{
						name: "ProductHapi2Dhis2Sync",
						request: {
						  path :"/dhis/api",
						  headers: {'Content-Type': 'application/json'},
						  querystring: "",
						  body:JSON.stringify( {'Process sync':'succeded'}),
						  method: "POST",
						  timestamp: new Date().getTime()
						},
						response: {
						  status: 200,
						  body:JSON.stringify({'OperationResult':'Not performed'}),
						  timestamp: new Date().getTime()
						}
					}
					];
					var returnObject = {
					  "x-mediator-urn": urn,
					  "status": status,
					  "response": response,
					  "orchestrations": orchestrationToReturn,
					  "properties": properties
					}
					winston.info("End of Hapi=>DHIS2 program orchestration");
					res.set('Content-Type', 'application/json+openhim');
					res.send(returnObject);
				}//else
				
			});//end of asyncProduct2Push
		
		});//end of getAllProducts
		
		
	})//end of app.get /product2dhsi2
	
	app.get('/program2dhis2', (req, res) => {
		var needle=require('needle')
		needle.defaults(
		{
			open_timeout: 600000
		});
		//console.log("Entered ....!");
		console.log("Start hapi=>dhis2 programs sync...!");
		const basicClientToken = `Basic ${btoa(mediatorConfig.config.dhis2Server.username+':'+mediatorConfig.config.dhis2Server.password)}`;
		//Get Product list from hapi
		var globalStoredList=[];
		//getAllPrograms("",globalStoredList,function(programLists)
		getAllProgramsCurl("",globalStoredList,function(programLists)
		{
			winston.info("Programs resources returned from Fhir..");
			//console.log(JSON.stringify(programLists[0]));
			//return;
			var orchestrationsProgram2Push=[];
			var OrchestrationsProgamCategoryProducts=[];
			//productLists[0].extension[0].extension[0].url
			
			//first create product as categoryOptions
			for(var iteratorOrch=0;iteratorOrch<programLists.length;iteratorOrch++)
			//for(var iteratorOrch=0;iteratorOrch<2;iteratorOrch++)
			{
				var oProgram=programLists[iteratorOrch];
				var codeProgram=oProgram.id;
				var productName=customLibrairy.getProgramName(oProgram);
				var programPayLoad={
					code:codeProgram,
					name:productName,
					shortName:productName.substr(50),
					displayName:productName
					}
				orchestrationsProgram2Push.push(
					{ 
					ctxObjectRef: codeProgram,
					name: codeProgram, 
					domain: mediatorConfig.config.dhis2Server.url,
					path:mediatorConfig.config.dhis2Server.apiPath+"/categoryOptions",
					params: "",
					body:  JSON.stringify(programPayLoad),
					method: "POST",
					headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
				
			}
			for(var iteratorOrch=0;iteratorOrch<programLists.length;iteratorOrch++)
			{
				var oProgram=programLists[iteratorOrch];
				var categoryName=customLibrairy.getCategoryProduct(oProgram).name;
				//console.log(categoryName);
				var codeProgram=categoryName.trim().replace(/\s/g,"");
				var productCategoryPayLoad={
					code:codeProgram,
					name:categoryName,
					shortName:categoryName.substr(50),
					displayName:categoryName
					}
				/*
				OrchestrationsProgamCategoryProducts.push(
					{ 
					ctxObjectRef: codeProgram,
					name: codeProgram, 
					domain: mediatorConfig.config.dhis2Server.url,
					path:mediatorConfig.config.dhis2Server.apiPath+"/categoryOptions",
					params: "",
					body:  JSON.stringify(programPayLoad),
					method: "POST",
					headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
				  * */
				
			}
			var asyncProgram2Push = require('async');
			var ctxObject2Update = []; 
			var orchestrationsResultsPrograms=[];
			var counterPush=1;
			
			asyncProgram2Push.each(orchestrationsProgram2Push, function(orchestrationProgram, callbackProgram) {
				var orchUrl = orchestrationProgram.domain + orchestrationProgram.path + orchestrationProgram.params;
				var options={
					headers:orchestrationProgram.headers
					};
				var program2Push=orchestrationProgram.body;
				//console.log(orchUrl);
				needle.post(orchUrl,program2Push,options, function(err, resp) {
					// if error occured
					
					if ( err ){
						winston.error("Needle: error when pushing programme data to dhis2");
						callbackProgram(err);
					}
					//console.log(resp);
					console.log("********************************************************");
					winston.info(counterPush+"/"+orchestrationsProgram2Push.length);
					winston.info("...Inserting "+orchestrationProgram.path);
					orchestrationsResultsPrograms.push({
					name: orchestrationProgram.name,
					request: {
					  path : orchestrationProgram.path,
					  headers: orchestrationProgram.headers,
					  querystring: orchestrationProgram.params,
					  body: orchestrationProgram.body,
					  method: orchestrationProgram.method,
					  timestamp: new Date().getTime()
					},
					response: {
					  status: resp.statusCode,
					  //body: JSON.stringify(resp.body.toString('utf8'), null, 4),
					  body: resp.body,
					  timestamp: new Date().getTime()
					}
					});
					//console.log(resp.body);
					// add orchestration response to context object and return callback
					ctxObject2Update[orchestrationProgram.ctxObjectRef] = resp.body;
					counterPush++;
					callbackProgram();
				});
			},function(err)
			{
				if(err)
				{
					winston.error(err);
				}
				winston.info("Creation of programme => categoryOptions done!")
				//console.log(orchestrationsResultsProducts[0].response.body);
				//Now check the responses, if created push catogoryOptions into the product  Categorie
				var listProgramIdCreated=[];
				for(var iteratorResp=0;iteratorResp<orchestrationsResultsPrograms.length;iteratorResp++)
				{
					var operationResponse=orchestrationsResultsPrograms[iteratorResp].response;
					var programCode=orchestrationsResultsPrograms[iteratorResp].name;
					if(operationResponse.body.httpStatus=="Created")
					{
						listProgramIdCreated.push(operationResponse.body.response.uid);
						winston.info("Program: "+programCode+" created with id = "+operationResponse.body.response.uid);
					}
					else if(operationResponse.body.httpStatus=="Conflict")
					{
						if(operationResponse.body.response.errorReports.length>0)
						{
							var resourceId=operationResponse.body.response.errorReports[0].mainId;
							listProductIdCreated.push(resourceId);
						}
					}
					else
					{
						winston.warn("Failed to create Programme: "+programCode);
					}
				}
				//If id product created assign them to the product category
				if(listProgramIdCreated.length>0)
				{
					var ochestrationProgramCollection=[];
					//Building the identifiable Ojects payload
					var identifiablePayload={
						identifiableObjects:[]
						};
					for(var iteratorCol=0;iteratorCol<listProgramIdCreated.length;iteratorCol++)
					{
						identifiablePayload.identifiableObjects.push(
							{
								id:listProgramIdCreated[iteratorCol]
							}
						);
					}
					ochestrationProgramCollection.push(
					{ 
						ctxObjectRef: "programsCollection",
						name: "programsCollection", 
						domain: mediatorConfig.config.dhis2Server.url,
						path:mediatorConfig.config.dhis2Server.apiPath+"/categories/"+mediatorConfig.config.programCategoryId+"/categoryOptions",
						params: "",
						body:  JSON.stringify(identifiablePayload),
						method: "POST",
						headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
					var asyncProgramCollection = require('async');
					var ctxObject2Update = []; 
					var orchestrationsResultsCollections=[];
					var counterCollection=1;
					
					asyncProgramCollection.each(ochestrationProgramCollection, function(orchestrationCollection, callbackCollection) {
						var orchUrl = orchestrationCollection.domain + orchestrationCollection.path + orchestrationCollection.params;
						var options={
							headers:orchestrationCollection.headers
							};
						var dataToPush=orchestrationCollection.body;
							needle.post(orchUrl,dataToPush,options, function(err, resp) {
								if ( err ){
									winston.error("Needle: error when pushing program data to the collection to dhis2");
									callbackCollection(err);
								}
								console.log("********************************************************");
								winston.info(counterCollection+"/"+ochestrationProgramCollection.length);
								winston.info("...Inserting "+orchestrationCollection.path);
								orchestrationsResultsCollections.push({
								name: orchestrationCollection.name,
								request: {
								  path : orchestrationCollection.path,
								  headers: orchestrationCollection.headers,
								  querystring: orchestrationCollection.params,
								  body: orchestrationCollection.body,
								  method: orchestrationCollection.method,
								  timestamp: new Date().getTime()
								},
								response: {
								  status: resp.statusCode,
								  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
								  //body: resp.body,
								  timestamp: new Date().getTime()
								}
								});
								ctxObject2Update.push({ref:orchestrationCollection.name,log:resp.body});
								counterCollection++;
								callbackCollection();
							});//end of needle
							
						},function(err)
						{
							if(err)
							{
								winston.error(err);
							}
							winston.info("Assign of program => Category done!");
							//console.log(orchestrationsResultsCollections[0].response);
							
							for(var iteratorResp=0;iteratorResp<orchestrationsResultsCollections.length;iteratorResp++)
							{
								//console.log(orchestrationsResultsCollections[iteratorResp].response);
								if(orchestrationsResultsCollections[iteratorResp].response.status>=200 && orchestrationsResultsCollections[iteratorResp].response.status<300)
								{
									winston.info("Assignment to the collection done for program categoryOption ");
									
								}
								else
								{
									
									winston.warn("Assignment to the collection failed for program categoryOption ");
								}
							}
							var urn = mediatorConfig.urn;
							var status = 'Successful';
							var response = {
							  status: 200,
							  headers: {
								'content-type': 'application/json'
							  },
							  body:JSON.stringify( {'OperationResult':'Program synched successfully into dhis2'}),
							  timestamp: new Date().getTime()
							};
							var properties = {};
							properties['Number program pushed'] =listProgramIdCreated.length;
							var returnObject = {
							  "x-mediator-urn": urn,
							  "status": status,
							  "response": response,
							  "orchestrations": orchestrationsResultsCollections,
							  "properties": properties
							}
							winston.info("End of Hapi=>DHIS2 program orchestration");
							res.set('Content-Type', 'application/json+openhim');
							res.send(returnObject);
						});//end of asyncProductCollection.each 
				}
				else
				{
					winston.warn("No program to assign to the category");
					var urn = mediatorConfig.urn;
					var status = 'Successful';
					var response = {
					  status: 200,
					  headers: {
						'content-type': 'application/json'
					  },
					  body:JSON.stringify( {'OperationResult':'No program to assign to the category'}),
					  timestamp: new Date().getTime()
					};
					var properties = {};
					properties['Number program pushed'] =0;
					var orchestrationToReturn=[
					{
						name: "ProgramsHapi2Dhis2Sync",
						request: {
						  path :"/dhis/api",
						  headers: {'Content-Type': 'application/json'},
						  querystring: "",
						  body:JSON.stringify( {'Process sync':'succeded'}),
						  method: "POST",
						  timestamp: new Date().getTime()
						},
						response: {
						  status: 200,
						  body:JSON.stringify({'OperationResult':'Not performed'}),
						  timestamp: new Date().getTime()
						}
					}
					];
					var returnObject = {
					  "x-mediator-urn": urn,
					  "status": status,
					  "response": response,
					  "orchestrations": orchestrationToReturn,
					  "properties": properties
					}
					winston.info("End of Hapi=>DHIS2 program orchestration");
					res.set('Content-Type', 'application/json+openhim');
					res.send(returnObject);
				}//end else
				
			});//end of asyncProduct2Push
		
		});//end of getAllProducts
		
		
	})//end of app.get /product2dhsi2
	
	app.get('/programProduct2dhis2', (req, res) => {
		var needle=require('needle')
		needle.defaults(
		{
			open_timeout: 600000
		});
		//console.log("Entered ....!");
		console.log("Start hapi=>dhis2 programs sync...!");
		const basicClientToken = `Basic ${btoa(mediatorConfig.config.dhis2Server.username+':'+mediatorConfig.config.dhis2Server.password)}`;
		//Get Product list from hapi
		var globalStoredListPorgram=[];
		//getAllPrograms("",globalStoredList,function(programLists)
		var programIdToProcess=mediatorConfig.config.programsToSync.split(",");
		var bundleParam="_format=json&_count=1&_id:in=";
		for(var iteratorProId=0;iteratorProId<programIdToProcess.length;iteratorProId++)
		{
			if(iteratorProId==0)
			{
				bundleParam=bundleParam+programIdToProcess[iteratorProId];
			}
			else
			{
				bundleParam=","+bundleParam+programIdToProcess[iteratorProId];
			}
		}//en for
		var urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/OrganizationAffiliation?${bundleParam}`;
		//bundleParam=
		getAllProgramsCurl(urlRequest,globalStoredListPorgram,function(programLists)
		{
			winston.info("Programs resources returned from Fhir..");
			//console.log(JSON.stringify(programLists[0]));
			//return;
			var orchestrationsProgram2Push=[];
			var OrchestrationsProgamCategoryProducts=[];
			//productLists[0].extension[0].extension[0].url
			
			//first create product as categoryOptions
			var listProgramPayload=[];
			for(var iteratorProg=0;iteratorProg<programLists.length;iteratorProg++)
			{
				var oProgram=programLists[iteratorProg];
				var codeProgram=oProgram.id;
				var productName=customLibrairy.getProgramName(oProgram);
				var programPayLoad={
					code:codeProgram,
					name:productName,
					shortName:productName.substr(50),
					displayName:productName
					}
				listProgramPayload.push(programPayLoad);
			}
			//Get list of products provided by each programs
			var listProductsIdToPull="_format=json&_count=1&_id:in=";
			for(var iteratorProg=0;iteratorProg<programLists.length;iteratorProg++)
			{
				var oProgram=programLists[iteratorProg];
				var listProductsByProgram=customLibrairy.getProgramProductsList(oProgram);
				//console.log(listProductsByProgram);
				//remove basics to build id product list with separated format
				for(var iteratorProdRef=0;iteratorProdRef<listProductsByProgram.length;iteratorProdRef++)
				{
					if(iteratorProdRef==0)
					{
						listProductsIdToPull=listProductsIdToPull+listProductsByProgram[iteratorProdRef].split("/")[1];
					}
					else
					{
						listProductsIdToPull=listProductsIdToPull+","+listProductsByProgram[iteratorProdRef].split("/")[1];
					}
					//console.log("Building string :"+listProductsIdToPull)
				}
			}//end for
			//Now get Products provided to the program
			var urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Basic?${listProductsIdToPull}`;
			var globalStoredListProducts=[];
			getAllProductsCurl(urlRequest,globalStoredListProducts,function(productLists)
			{
				//console.log("Total product number retained:"+ProductLists.length);
				//Now build the product payload
				var listProductPayLoad=[];
				for(var iteratorProd=0;iteratorProd<productLists.length;iteratorProd++)
				{
					var oProduct=productLists[iteratorProd];
					var codeProduct=oProduct.id;
					var productName=customLibrairy.getProductName(oProduct);
					var productPayLoad={
						code:oProduct.id,
						name:productName,
						shortName:productName.substr(50),
						displayName:productName
						}
					listProductPayLoad.push(productPayLoad);
				}
				//Start by Pushing programs
				var orchestrationsProgram2Push=[];
				for(var iteratorProg=0;iteratorProg< listProgramPayload.length;iteratorProg++)
				{
					orchestrationsProgram2Push.push(
					{ 
					ctxObjectRef: listProgramPayload[iteratorProg].code,
					name: listProgramPayload[iteratorProg].code, 
					domain: mediatorConfig.config.dhis2Server.url,
					path:mediatorConfig.config.dhis2Server.apiPath+"/categoryOptions",
					params: "",
					body:  JSON.stringify(listProgramPayload[iteratorProg]),
					method: "POST",
					headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
				}//end for listProgramPayload
				var asyncProgram2Push = require('async');
				var ctxObject2Update = []; 
				var orchestrationsResultsPrograms=[];
				var counterPush=1;
				asyncProgram2Push.each(orchestrationsProgram2Push, function(orchestrationProgram, callbackProgram) {
					var orchUrl = orchestrationProgram.domain + orchestrationProgram.path + orchestrationProgram.params;
					var options={
						headers:orchestrationProgram.headers
						};
					var program2Push=orchestrationProgram.body;
					//console.log(orchUrl);
					needle.post(orchUrl,program2Push,options, function(err, resp) {
						// if error occured
						
						if ( err ){
							winston.error("Needle: error when pushing programme data to dhis2");
							callbackProgram(err);
						}
						//console.log(resp);
						console.log("********************************************************");
						winston.info(counterPush+"/"+orchestrationsProgram2Push.length);
						winston.info("...Inserting "+orchestrationProgram.path);
						orchestrationsResultsPrograms.push({
						name: orchestrationProgram.name,
						request: {
						  path : orchestrationProgram.path,
						  headers: orchestrationProgram.headers,
						  querystring: orchestrationProgram.params,
						  body: orchestrationProgram.body,
						  method: orchestrationProgram.method,
						  timestamp: new Date().getTime()
						},
						response: {
						  status: resp.statusCode,
						  //body: JSON.stringify(resp.body.toString('utf8'), null, 4),
						  body: resp.body,
						  timestamp: new Date().getTime()
						}
						});
						//console.log(resp.body);
						// add orchestration response to context object and return callback
						ctxObject2Update[orchestrationProgram.ctxObjectRef] = resp.body;
						counterPush++;
						callbackProgram();
					});
				},function(err)
				{
					if(err)
					{
						winston.error(err);
					}
					winston.info("Creation of programme => categoryOptions done!")
					var listProgramIdCreated=[];
					for(var iteratorResp=0;iteratorResp<orchestrationsResultsPrograms.length;iteratorResp++)
					{
						var operationResponse=orchestrationsResultsPrograms[iteratorResp].response;
						var programCode=orchestrationsResultsPrograms[iteratorResp].name;
						if(operationResponse.body.httpStatus=="Created")
						{
							listProgramIdCreated.push(operationResponse.body.response.uid);
							winston.info("Program: "+programCode+" created with id = "+operationResponse.body.response.uid);
						}
						else if(operationResponse.body.httpStatus=="Conflict")
						{
							if(operationResponse.body.response.errorReports.length>0)
							{
								var resourceId=operationResponse.body.response.errorReports[0].mainId;
								listProgramIdCreated.push(resourceId);
							}
						}
						else
						{
							winston.warn("Failed to create Programme: "+programCode);
						}
					}//end for orchestrationsResultsPrograms
					if(listProgramIdCreated.length>0)
					{
						var ochestrationProgramCollection=[];
						//Building the identifiable Ojects payload
						var identifiablePayload={
							identifiableObjects:[]
							};
						for(var iteratorCol=0;iteratorCol<listProgramIdCreated.length;iteratorCol++)
						{
							identifiablePayload.identifiableObjects.push(
								{
									id:listProgramIdCreated[iteratorCol]
								}
							);
						}
						ochestrationProgramCollection.push(
						{ 
							ctxObjectRef: "programsCollection",
							name: "programsCollection", 
							domain: mediatorConfig.config.dhis2Server.url,
							path:mediatorConfig.config.dhis2Server.apiPath+"/categories/"+mediatorConfig.config.programCategoryId+"/categoryOptions",
							params: "",
							body:  JSON.stringify(identifiablePayload),
							method: "POST",
							headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
					  });
					  var asyncProgramCollection = require('async');
					var ctxObject2Update = []; 
					var orchestrationsResultsCollections=[];
					var counterCollection=1;
					asyncProgramCollection.each(ochestrationProgramCollection, function(orchestrationCollection, callbackCollection) {
						var orchUrl = orchestrationCollection.domain + orchestrationCollection.path + orchestrationCollection.params;
						var options={
							headers:orchestrationCollection.headers
							};
						var dataToPush=orchestrationCollection.body;
							needle.post(orchUrl,dataToPush,options, function(err, resp) {
								if ( err ){
									winston.error("Needle: error when pushing program data to the collection to dhis2");
									callbackCollection(err);
								}
								console.log("********************************************************");
								winston.info(counterCollection+"/"+ochestrationProgramCollection.length);
								winston.info("...Inserting "+orchestrationCollection.path);
								orchestrationsResultsCollections.push({
								name: orchestrationCollection.name,
								request: {
								  path : orchestrationCollection.path,
								  headers: orchestrationCollection.headers,
								  querystring: orchestrationCollection.params,
								  body: orchestrationCollection.body,
								  method: orchestrationCollection.method,
								  timestamp: new Date().getTime()
								},
								response: {
								  status: resp.statusCode,
								  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
								  //body: resp.body,
								  timestamp: new Date().getTime()
								}
								});
								ctxObject2Update.push({ref:orchestrationCollection.name,log:resp.body});
								counterCollection++;
								callbackCollection();
							});//end of needle
							
						},function(err)
						{
							
							if(err)
							{
								winston.error(err);
							}
							winston.info("Assign of program => Category done!");
							//console.log(orchestrationsResultsCollections[0].response);
							
							for(var iteratorResp=0;iteratorResp<orchestrationsResultsCollections.length;iteratorResp++)
							{
								//console.log(orchestrationsResultsCollections[iteratorResp].response);
								if(orchestrationsResultsCollections[iteratorResp].response.status>=200 && orchestrationsResultsCollections[iteratorResp].response.status<300)
								{
									winston.info("Assignment to the collection done for program categoryOption ");
									
								}
								else
								{
									
									winston.warn("Assignment to the collection failed for program categoryOption ");
								}
							}
							//Now sync product to dhis2
							winston.info("Start hapi=>dhis2 products sync...!");
							var orchestrationsProducts2Push=[];
							for(var iteratorProd=0;iteratorProd<listProductPayLoad.length;iteratorProd++)
							{
								orchestrationsProducts2Push.push(
								{ 
									ctxObjectRef: listProductPayLoad[iteratorProd].code,
									name: listProductPayLoad[iteratorProd].code, 
									domain: mediatorConfig.config.dhis2Server.url,
									path:mediatorConfig.config.dhis2Server.apiPath+"/categoryOptions",
									params: "",
									body:  JSON.stringify(listProductPayLoad[iteratorProd]),
									method: "POST",
									headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
							  });
				
							}
							var asyncProduct2Push = require('async');
							var ctxObject2Update = []; 
							var orchestrationsResultsProducts=[];
							var counterPush=1;
							asyncProduct2Push.each(orchestrationsProducts2Push, function(orchestrationProduct, callbackProduct) {
								var orchUrl = orchestrationProduct.domain + orchestrationProduct.path + orchestrationProduct.params;
								var options={
									headers:orchestrationProduct.headers
									};
								var product2Push=orchestrationProduct.body;
								//console.log(orchUrl);
								needle.post(orchUrl,product2Push,options, function(err, resp) {
									// if error occured
									
									if ( err ){
										winston.error("Needle: error when pushing product data to dhis2");
										callbackProduct(err);
									}
									//console.log(resp);
									console.log("********************************************************");
									winston.info(counterPush+"/"+orchestrationsProducts2Push.length);
									winston.info("...Inserting "+orchestrationProduct.path);
									orchestrationsResultsProducts.push({
									name: orchestrationProduct.name,
									request: {
									  path : orchestrationProduct.path,
									  headers: orchestrationProduct.headers,
									  querystring: orchestrationProduct.params,
									  body: orchestrationProduct.body,
									  method: orchestrationProduct.method,
									  timestamp: new Date().getTime()
									},
									response: {
									  status: resp.statusCode,
									  //body: JSON.stringify(resp.body.toString('utf8'), null, 4),
									  body: resp.body,
									  timestamp: new Date().getTime()
									}
									});
									//console.log(resp.body);
									// add orchestration response to context object and return callback
									ctxObject2Update[orchestrationProduct.ctxObjectRef] = resp.body;
									counterPush++;
									callbackProduct();
								});
							},function(err)
							{
								if(err)
								{
									winston.error(err);
								}
								winston.info("Creation of product => categoryOptions done!")
								//console.log(orchestrationsResultsProducts[0].response.body);
								//Now check the responses, if created push catogoryOptions into the product  Categorie
								var listProductIdCreated=[];
								for(var iteratorResp=0;iteratorResp<orchestrationsResultsProducts.length;iteratorResp++)
								{
									var operationResponse=orchestrationsResultsProducts[iteratorResp].response;
									var productCode=orchestrationsResultsProducts[iteratorResp].name;
									//console.log(JSON.stringify(operationResponse));
									if(operationResponse.body.httpStatus=="Created")
									{
										listProductIdCreated.push(operationResponse.body.response.uid);
										winston.info("Product: "+productCode+" created with id = "+operationResponse.body.response.uid);
									}
									else if(operationResponse.body.httpStatus=="Conflict")
									{
										if(operationResponse.body.response.errorReports.length>0)
										{
											var resourceId=operationResponse.body.response.errorReports[0].mainId;
											listProductIdCreated.push(resourceId);
										}
									}
									else
									{
										winston.warn("Failed to create Product: "+productCode);
									}
								}//end for iteratorResp
								//If id product created assign them to the product category
								if(listProductIdCreated.length>0)
								{
									var ochestrationProductCollection=[];
									var identifiablePayload={
										identifiableObjects:[]
										};
									for(var iteratorCol=0;iteratorCol<listProductIdCreated.length;iteratorCol++)
									{
										identifiablePayload.identifiableObjects.push(
											{
												id:listProductIdCreated[iteratorCol]
											}
										);
									}
									ochestrationProductCollection.push(
									{ 
										ctxObjectRef: "productsCollection",
										name: "productsCollection", 
										domain: mediatorConfig.config.dhis2Server.url,
										path:mediatorConfig.config.dhis2Server.apiPath+"/categories/"+mediatorConfig.config.productCategoryId+"/categoryOptions",
										params: "",
										body:  JSON.stringify(identifiablePayload),
										method: "POST",
										headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
									});
									var asyncProductCollection = require('async');
									var ctxObject2Update = []; 
									var orchestrationsResultsCollections=[];
									var counterCollection=1;
									asyncProductCollection.each(ochestrationProductCollection, function(orchestrationCollection, callbackCollection) {
									var orchUrl = orchestrationCollection.domain + orchestrationCollection.path + orchestrationCollection.params;
									var options={
										headers:orchestrationCollection.headers
										};
									var dataToPush=orchestrationCollection.body;
										needle.post(orchUrl,dataToPush,options, function(err, resp) {
											if ( err ){
												winston.error("Needle: error when pushing product data to the collection to dhis2");
												callbackProduct(err);
											}
											console.log("********************************************************");
											winston.info(counterCollection+"/"+ochestrationProductCollection.length);
											winston.info("...Inserting "+orchestrationCollection.path);
											orchestrationsResultsCollections.push({
											name: orchestrationCollection.name,
											request: {
											  path : orchestrationCollection.path,
											  headers: orchestrationCollection.headers,
											  querystring: orchestrationCollection.params,
											  body: orchestrationCollection.body,
											  method: orchestrationCollection.method,
											  timestamp: new Date().getTime()
											},
											response: {
											  status: resp.statusCode,
											  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
											  //body: resp.body,
											  timestamp: new Date().getTime()
											}
											});
											ctxObject2Update.push({ref:orchestrationCollection.name,log:resp.body});
											counterCollection++;
											callbackCollection();
										});//end of needle
										
									},function(err)
									{
										if(err)
										{
											winston.error(err);
										}
										winston.info("Assign of products => Category done!");
										console.log(orchestrationsResultsCollections[0].response);
										
										for(var iteratorResp=0;iteratorResp<orchestrationsResultsCollections.length;iteratorResp++)
										{
											//console.log(orchestrationsResultsCollections[iteratorResp].response);
											if(orchestrationsResultsCollections[iteratorResp].response.status>=200 && orchestrationsResultsCollections[iteratorResp].response.status<300)
											{
												winston.info("Assignment to the collection done for categoryOption ");
												
											}
											else
											{
												
												winston.warn("Assignment to the collection failed for categoryOption ");
												//console.log(ctxObject2Update);
											}
										}
										var urn = mediatorConfig.urn;
										var status = 'Successful';
										var response = {
										  status: 200,
										  headers: {
											'content-type': 'application/json'
										  },
										  body:JSON.stringify( {'OperationResult':'Product synched successfully into dhis2'}),
										  timestamp: new Date().getTime()
										};
										var properties = {};
										properties['Number product pushed'] =listProductIdCreated.length;
										var returnObject = {
										  "x-mediator-urn": urn,
										  "status": status,
										  "response": response,
										  "orchestrations": orchestrationsResultsCollections,
										  "properties": properties
										}
										winston.info("End of Hapi=>DHIS2 produit orchestration");
										res.set('Content-Type', 'application/json+openhim');
										res.send(returnObject);
									});
									
								}//end if listProductIdCreated
								else
								{
									winston.warn("No product to assign to the category");
									var urn = mediatorConfig.urn;
									var status = 'Successful';
									var response = {
									  status: 200,
									  headers: {
										'content-type': 'application/json'
									  },
									  body:JSON.stringify( {'OperationResult':'No product to assign to the category'}),
									  timestamp: new Date().getTime()
									};
									var properties = {};
									properties['Numner product pushed'] =0;
									var orchestrationToReturn=[
									{
										name: "ProductHapi2Dhis2Sync",
										request: {
										  path :"/dhis/api",
										  headers: {'Content-Type': 'application/json'},
										  querystring: "",
										  body:JSON.stringify( {'Process sync':'succeded'}),
										  method: "POST",
										  timestamp: new Date().getTime()
										},
										response: {
										  status: 200,
										  body:JSON.stringify({'OperationResult':'Not performed'}),
										  timestamp: new Date().getTime()
										}
									}
									];
									var returnObject = {
									  "x-mediator-urn": urn,
									  "status": status,
									  "response": response,
									  "orchestrations": orchestrationToReturn,
									  "properties": properties
									}
									winston.info("End of Hapi=>DHIS2 program orchestration");
									res.set('Content-Type', 'application/json+openhim');
									res.send(returnObject);
								}
							})//end of asyncProduct2Push
							
							
						})//end of asyncProgramCollection
					
					
					
					
					
					}//end if listProgramIdCreated
			})//end async 
				
				//return;
			})//end of getAllProducts
		});//end of getAllPrograms
		
		
	})//end of app.get /product2dhsi2
	
	app.get('/catproduct2dhis2', (req, res) => {
		var needle = require('needle');
		needle.defaults(
		{
			open_timeout: 600000
		});
		//console.log("Entered ....!");
		console.log("Start hapi=>dhis2 programs sync...!");
		const basicClientToken = `Basic ${btoa(mediatorConfig.config.dhis2Server.username+':'+mediatorConfig.config.dhis2Server.password)}`;
		//Get Product list from hapi
		var globalStoredList=[];
		//getAllPrograms("",globalStoredList,function(programLists)
		getAllProgramsCurl("",globalStoredList,function(programLists)
		{
			winston.info("Products categories resources returned from Fhir..");
			//console.log(JSON.stringify(productLists[0]));
			//return;
			var OrchestrationsProgamCategoryProducts=[];
			//first create resources as categoryOptions
			
			for(var iteratorOrch=0;iteratorOrch<programLists.length;iteratorOrch++)
			{
				var oProgram=programLists[iteratorOrch];
				var productCategory=customLibrairy.getCategoryProduct(oProgram);
				//console.log(categoryName);
				//var codeProgram=productCategory.name;
				var productCategoryPayLoad={
					code:productCategory.code,
					name:productCategory.name,
					shortName:productCategory.name.substr(50),
					displayName:productCategory.name
					}
				
				OrchestrationsProgamCategoryProducts.push(
					{ 
					ctxObjectRef: productCategory.code,
					name: productCategory.code, 
					domain: mediatorConfig.config.dhis2Server.url,
					path:mediatorConfig.config.dhis2Server.apiPath+"/categoryOptions",
					params: "",
					body:  JSON.stringify(productCategoryPayLoad),
					method: "POST",
					headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
				
			}
			var asyncProductCategories2Push = require('async');
			var ctxObject2Update = []; 
			var orchestrationsResultsResource=[];
			var counterPush=1;
			
			asyncProductCategories2Push.each(OrchestrationsProgamCategoryProducts, function(orchestrationProdCategory, callbackProgram) {
				var orchUrl = orchestrationProdCategory.domain + orchestrationProdCategory.path + orchestrationProdCategory.params;
				var options={
					headers:orchestrationProdCategory.headers
					};
				var resource2Push=orchestrationProdCategory.body;
				//console.log(orchUrl);
				needle.post(orchUrl,resource2Push,options, function(err, resp) {
					// if error occured
					
					if ( err ){
						winston.error("Needle: error when pushing programme data to dhis2");
						callbackProgram(err);
					}
					//console.log(resp);
					console.log("********************************************************");
					winston.info(counterPush+"/"+OrchestrationsProgamCategoryProducts.length);
					winston.info("...Inserting "+orchestrationProdCategory.path);
					orchestrationsResultsResource.push({
					name: orchestrationProdCategory.name,
					request: {
					  path : orchestrationProdCategory.path,
					  headers: orchestrationProdCategory.headers,
					  querystring: orchestrationProdCategory.params,
					  body: orchestrationProdCategory.body,
					  method: orchestrationProdCategory.method,
					  timestamp: new Date().getTime()
					},
					response: {
					  status: resp.statusCode,
					  body: resp.body,
					  timestamp: new Date().getTime()
					}
					});
					//console.log(resp.body);
					// add orchestration response to context object and return callback
					ctxObject2Update[orchestrationProdCategory.ctxObjectRef] = resp.body;
					counterPush++;
					callbackProgram();
				});
			},function(err)
			{
				if(err)
				{
					winston.error(err);
				}
				winston.info("Creation of products category => categoryOptions done!")
				//console.log(orchestrationsResultsResource[0]);
				//console.log("///////////////////////////////////////////////////////////////");
				//Now check the responses, if created push catogoryOptions into the product  Categorie
				var listResourceIdCreated=[];
				for(var iteratorResp=0;iteratorResp<orchestrationsResultsResource.length;iteratorResp++)
				{
					var operationResponse=orchestrationsResultsResource[iteratorResp].response;
					//console.log(operationResponse);
					var prodCatCode=orchestrationsResultsResource[iteratorResp].name;
					if(operationResponse.body.httpStatus=="Created")
					{
						listResourceIdCreated.push(operationResponse.body.response.uid);
						winston.info("Product Category: "+prodCatCode+" created with id = "+operationResponse.body.response.uid);
					}
					else if(operationResponse.body.httpStatus=="Conflict")
					{
						if(operationResponse.body.response.errorReports.length>0)
						{
							var resourceId=operationResponse.body.response.errorReports[0].mainId;
							listProductIdCreated.push(resourceId);
						}
					}
					else
					{
						winston.warn("Failed to create product category: "+prodCatCode);
					}
				}
				//If id product created assign them to the product category
				if(listResourceIdCreated.length>0)
				{
					var ochestrationResourceCollection=[];
					//Building the identifiable Ojects payload
					var identifiablePayload={
						identifiableObjects:[]
						};
					for(var iteratorCol=0;iteratorCol<listResourceIdCreated.length;iteratorCol++)
					{
						identifiablePayload.identifiableObjects.push(
							{
								id:listResourceIdCreated[iteratorCol]
							}
						);
					}
					ochestrationResourceCollection.push(
					{ 
						ctxObjectRef: "productCategoryCollection",
						name: "productCategoryCollection", 
						domain: mediatorConfig.config.dhis2Server.url,
						path:mediatorConfig.config.dhis2Server.apiPath+"/categories/"+mediatorConfig.config.programProductCategoryId+"/categoryOptions",
						params: "",
						body:  JSON.stringify(identifiablePayload),
						method: "POST",
						headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
					var asyncResourceCollection = require('async');
					var ctxObject2Update = []; 
					var orchestrationsResultsCollections=[];
					var counterCollection=1;
					
					asyncResourceCollection.each(ochestrationResourceCollection, function(orchestrationCollection, callbackCollection) {
						var orchUrl = orchestrationCollection.domain + orchestrationCollection.path + orchestrationCollection.params;
						var options={
							headers:orchestrationCollection.headers
							};
						var dataToPush=orchestrationCollection.body;
							needle.post(orchUrl,dataToPush,options, function(err, resp) {
								if ( err ){
									winston.error("Needle: error when pushing product category data to the collection to dhis2");
									callbackCollection(err);
								}
								console.log("********************************************************");
								winston.info(counterCollection+"/"+ochestrationResourceCollection.length);
								winston.info("...Inserting "+orchestrationCollection.path);
								orchestrationsResultsCollections.push({
								name: orchestrationCollection.name,
								request: {
								  path : orchestrationCollection.path,
								  headers: orchestrationCollection.headers,
								  querystring: orchestrationCollection.params,
								  body: orchestrationCollection.body,
								  method: orchestrationCollection.method,
								  timestamp: new Date().getTime()
								},
								response: {
								  status: resp.statusCode,
								  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
								  //body: resp.body,
								  timestamp: new Date().getTime()
								}
								});
								ctxObject2Update.push({ref:orchestrationCollection.name,log:resp.body});
								counterCollection++;
								callbackCollection();
							});//end of needle
							
						},function(err)
						{
							if(err)
							{
								winston.error(err);
							}
							winston.info("Assign of product category => Category done!");
							//console.log(orchestrationsResultsCollections[0].response);
							
							for(var iteratorResp=0;iteratorResp<orchestrationsResultsCollections.length;iteratorResp++)
							{
								//console.log(orchestrationsResultsCollections[iteratorResp].response);
								if(orchestrationsResultsCollections[iteratorResp].response.status>=200 && orchestrationsResultsCollections[iteratorResp].response.status<300)
								{
									winston.info("Assignment to the collection done for productsCategory categoryOption ");
									
								}
								else
								{
									
									winston.warn("Assignment to the collection failed for productsCategory categoryOption ");
								}
							}
							var urn = mediatorConfig.urn;
							var status = 'Successful';
							var response = {
							  status: 200,
							  headers: {
								'content-type': 'application/json'
							  },
							  body:JSON.stringify( {'OperationResult':'Products category synched successfully into dhis2'}),
							  timestamp: new Date().getTime()
							};
							var properties = {};
							properties['Number products category pushed'] =listResourceIdCreated.length;
							var returnObject = {
							  "x-mediator-urn": urn,
							  "status": status,
							  "response": response,
							  "orchestrations": orchestrationsResultsCollections,
							  "properties": properties
							}
							winston.info("End of Hapi=>DHIS2 program orchestration");
							res.set('Content-Type', 'application/json+openhim');
							res.send(returnObject);
						});//end of asyncProductCollection.each 
				}
				else
				{
					winston.warn("No products category to assign to the category");
					var urn = mediatorConfig.urn;
					var status = 'Successful';
					var response = {
					  status: 200,
					  headers: {
						'content-type': 'application/json'
					  },
					  body:JSON.stringify( {'OperationResult':'No products category to assign to the category'}),
					  timestamp: new Date().getTime()
					};
					var properties = {};
					properties['Number products category pushed'] =0;
					var orchestrationToReturn=[
					{
						name: "ProductsCategoryHapi2Dhis2Sync",
						request: {
						  path :"/dhis/api",
						  headers: {'Content-Type': 'application/json'},
						  querystring: "",
						  body:JSON.stringify( {'Process sync':'succeded'}),
						  method: "POST",
						  timestamp: new Date().getTime()
						},
						response: {
						  status: 200,
						  body:JSON.stringify({'OperationResult':'Not performed'}),
						  timestamp: new Date().getTime()
						}
					}
					];
					var returnObject = {
					  "x-mediator-urn": urn,
					  "status": status,
					  "response": response,
					  "orchestrations": orchestrationToReturn,
					  "properties": properties
					}
					winston.info("End of Hapi=>DHIS2 program orchestration");
					res.set('Content-Type', 'application/json+openhim');
					res.send(returnObject);
				}//end else
				
			});//end of asyncProduct2Push
		
		});//end of getAllProducts
		
		
	})//end of app.get /product2dhsi2
	app.get('/dispensingUnit2dhis2', (req, res) => {
		var needle = require('needle');
		needle.defaults(
		{
			open_timeout: 600000
		});
		//console.log("Entered ....!");
		console.log("Start hapi=>dhis2 dispensingunit sync...!");
		const basicClientToken = `Basic ${btoa(mediatorConfig.config.dhis2Server.username+':'+mediatorConfig.config.dhis2Server.password)}`;
		//Get Product list from hapi
		var globalStoredList=[];
		//getAllProducts("",globalStoredList,function(productLists)
		getAllProductsCurl("",globalStoredList,function(productLists)
		{
			winston.info("Products categories resources returned from Fhir..");
			//console.log(JSON.stringify(productLists[0]));
			//return;
			var OrchestrationsDispenensing2Push=[];
			//first create resources as categoryOptions
			var listDispensingUnit=customLibrairy.getAllDispensingUnitFormProduct(productLists);
			//console.log(listDispensingUnit);
			//console.log("************************************************");
			//return;
			for(var iteratorOrch=0;iteratorOrch<listDispensingUnit.length;iteratorOrch++)
			{
				var oDispensing=listDispensingUnit[iteratorOrch];
				var dispensingPayLoad={
					code:oDispensing,
					name:oDispensing,
					shortName:oDispensing.substr(50),
					displayName:oDispensing
					}
				
				OrchestrationsDispenensing2Push.push(
					{ 
					ctxObjectRef: oDispensing,
					name: oDispensing, 
					domain: mediatorConfig.config.dhis2Server.url,
					path:mediatorConfig.config.dhis2Server.apiPath+"/categoryOptions",
					params: "",
					body:  JSON.stringify(dispensingPayLoad),
					method: "POST",
					headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
				
			}
			var asyncDispensing2Push = require('async');
			var ctxObject2Update = []; 
			var orchestrationsResultsResource=[];
			var counterPush=1;
			
			asyncDispensing2Push.each(OrchestrationsDispenensing2Push, function(orchestrationDispensingUnit, callbackProgram) {
				var orchUrl = orchestrationDispensingUnit.domain + orchestrationDispensingUnit.path + orchestrationDispensingUnit.params;
				var options={
					headers:orchestrationDispensingUnit.headers
					};
				var resource2Push=orchestrationDispensingUnit.body;
				//console.log(orchUrl);
				needle.post(orchUrl,resource2Push,options, function(err, resp) {
					// if error occured
					
					if ( err ){
						winston.error("Needle: error when pushing dispensing unit data to dhis2");
						callbackProgram(err);
					}
					//console.log(resp);
					console.log("********************************************************");
					winston.info(counterPush+"/"+OrchestrationsDispenensing2Push.length);
					winston.info("...Inserting "+orchestrationDispensingUnit.path);
					orchestrationsResultsResource.push({
					name: orchestrationDispensingUnit.name,
					request: {
					  path : orchestrationDispensingUnit.path,
					  headers: orchestrationDispensingUnit.headers,
					  querystring: orchestrationDispensingUnit.params,
					  body: orchestrationDispensingUnit.body,
					  method: orchestrationDispensingUnit.method,
					  timestamp: new Date().getTime()
					},
					response: {
					  status: resp.statusCode,
					  body: resp.body,
					  timestamp: new Date().getTime()
					}
					});
					//console.log(resp.body);
					// add orchestration response to context object and return callback
					ctxObject2Update[orchestrationDispensingUnit.ctxObjectRef] = resp.body;
					counterPush++;
					callbackProgram();
				});
			},function(err)
			{
				if(err)
				{
					winston.error(err);
				}
				winston.info("Creation of dispensingunit => categoryOptions done!")
				//console.log(orchestrationsResultsResource);
				//Now check the responses, if created push catogoryOptions into the product  Categorie
				var listResourceIdCreated=[];
				for(var iteratorResp=0;iteratorResp<orchestrationsResultsResource.length;iteratorResp++)
				{
					var operationResponse=orchestrationsResultsResource[iteratorResp].response;
					var dispensingUnitCode=orchestrationsResultsResource[iteratorResp].name;
					if(operationResponse.body.httpStatus=="Created")
					{
						listResourceIdCreated.push(operationResponse.body.response.uid);
						winston.info("Dispensing unit: "+dispensingUnitCode+" created with id = "+operationResponse.body.response.uid);
					}
					else if(operationResponse.body.httpStatus=="Conflict")
					{
						if(operationResponse.body.response.errorReports.length>0)
						{
							var resourceId=operationResponse.body.response.errorReports[0].mainId;
							listResourceIdCreated.push(resourceId);
						}
					}
					else
					{
						winston.warn("Failed to create product category: "+prodCatCode);
					}
				}
				//If id product created assign them to the product category
				if(listResourceIdCreated.length>0)
				{
					var ochestrationResourceCollection=[];
					//Building the identifiable Ojects payload
					var identifiablePayload={
						identifiableObjects:[]
						};
					for(var iteratorCol=0;iteratorCol<listResourceIdCreated.length;iteratorCol++)
					{
						identifiablePayload.identifiableObjects.push(
							{
								id:listResourceIdCreated[iteratorCol]
							}
						);
					}
					ochestrationResourceCollection.push(
					{ 
						ctxObjectRef: "dispensingUnitsCollection",
						name: "dispensingUnitsCollection", 
						domain: mediatorConfig.config.dhis2Server.url,
						path:mediatorConfig.config.dhis2Server.apiPath+"/categories/"+mediatorConfig.config.dispensingUnitCategoryId+"/categoryOptions",
						params: "",
						body:  JSON.stringify(identifiablePayload),
						method: "POST",
						headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
				  });
					var asyncResourceCollection = require('async');
					var ctxObject2Update = []; 
					var orchestrationsResultsCollections=[];
					var counterCollection=1;
					
					asyncResourceCollection.each(ochestrationResourceCollection, function(orchestrationCollection, callbackCollection) {
						var orchUrl = orchestrationCollection.domain + orchestrationCollection.path + orchestrationCollection.params;
						var options={
							headers:orchestrationCollection.headers
							};
						var dataToPush=orchestrationCollection.body;
							needle.post(orchUrl,dataToPush,options, function(err, resp) {
								if ( err ){
									winston.error("Needle: error when pushing dispensing unit data to the collection to dhis2");
									callbackCollection(err);
								}
								console.log("********************************************************");
								winston.info(counterCollection+"/"+ochestrationResourceCollection.length);
								winston.info("...Inserting "+orchestrationCollection.path);
								orchestrationsResultsCollections.push({
								name: orchestrationCollection.name,
								request: {
								  path : orchestrationCollection.path,
								  headers: orchestrationCollection.headers,
								  querystring: orchestrationCollection.params,
								  body: orchestrationCollection.body,
								  method: orchestrationCollection.method,
								  timestamp: new Date().getTime()
								},
								response: {
								  status: resp.statusCode,
								  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
								  //body: resp.body,
								  timestamp: new Date().getTime()
								}
								});
								ctxObject2Update.push({ref:orchestrationCollection.name,log:resp.body});
								counterCollection++;
								callbackCollection();
							});//end of needle
							
						},function(err)
						{
							if(err)
							{
								winston.error(err);
							}
							winston.info("Assign of dispensing unit => Category done!");
							//console.log(orchestrationsResultsCollections[0].response);
							
							for(var iteratorResp=0;iteratorResp<orchestrationsResultsCollections.length;iteratorResp++)
							{
								//console.log(orchestrationsResultsCollections[iteratorResp].response);
								if(orchestrationsResultsCollections[iteratorResp].response.status>=200 && orchestrationsResultsCollections[iteratorResp].response.status<300)
								{
									winston.info("Assignment to the collection done for dispensing unit categoryOption ");
									
								}
								else
								{
									
									winston.warn("Assignment to the collection failed for dispensing unit categoryOption ");
								}
							}
							var urn = mediatorConfig.urn;
							var status = 'Successful';
							var response = {
							  status: 200,
							  headers: {
								'content-type': 'application/json'
							  },
							  body:JSON.stringify( {'OperationResult':'Dispensing unit synched successfully into dhis2'}),
							  timestamp: new Date().getTime()
							};
							var properties = {};
							properties['Number dispensing unit pushed'] =listResourceIdCreated.length;
							var returnObject = {
							  "x-mediator-urn": urn,
							  "status": status,
							  "response": response,
							  "orchestrations": orchestrationsResultsCollections,
							  "properties": properties
							}
							winston.info("End of Hapi=>DHIS2 program orchestration");
							res.set('Content-Type', 'application/json+openhim');
							res.send(returnObject);
						});//end of asyncProductCollection.each 
				}
				else
				{
					winston.warn("No dispensingUnit to assign to the category");
					var urn = mediatorConfig.urn;
					var status = 'Successful';
					var response = {
					  status: 200,
					  headers: {
						'content-type': 'application/json'
					  },
					  body:JSON.stringify( {'OperationResult':'dispensingUnit to assign to the category'}),
					  timestamp: new Date().getTime()
					};
					var properties = {};
					properties['Number dispensing unit pushed'] =0;
					var orchestrationToReturn=[
					{
						name: "DispensingHapi2Dhis2Sync",
						request: {
						  path :"/dhis/api",
						  headers: {'Content-Type': 'application/json'},
						  querystring: "",
						  body:JSON.stringify( {'Process sync':'succeded'}),
						  method: "POST",
						  timestamp: new Date().getTime()
						},
						response: {
						  status: 200,
						  body:JSON.stringify({'OperationResult':'Not performed'}),
						  timestamp: new Date().getTime()
						}
					}
					];
					var returnObject = {
					  "x-mediator-urn": urn,
					  "status": status,
					  "response": response,
					  "orchestrations": orchestrationToReturn,
					  "properties": properties
					}
					winston.info("End of Hapi=>DHIS2 dispensingunit orchestration");
					res.set('Content-Type', 'application/json+openhim');
					res.send(returnObject);
				}//end else
				
			});//end of asyncProduct2Push
		
		});//end of getAllProducts
		
		
	})//end of app.get /product2dhsi2
	app.get('/requisition2dhis2', (req, res) => {
		var needle = require('needle');
		needle.defaults(
		{
			open_timeout: 600000
		});
		winston.info("Start hapi=>dhis2 requisitions sync...!");
		const basicClientToken = `Basic ${btoa(mediatorConfig.config.dhis2Server.username+':'+mediatorConfig.config.dhis2Server.password)}`;
		var globalStoredList=[];
		//getAllRequisitions("",globalStoredList,function(requisitionLists)
		getAllRequisitionsCurl("",globalStoredList,function(requisitionsList)
		{
			winston.info("Requisitions resources returned from Fhir.."+requisitionsList.length);
			var listRequisitionsBySetProgram=[];
			var listProgramToProcess=mediatorConfig.config.programsToSync.split(",");
			//Now get Requisition for the program set
			for(var iteratorProg=0;iteratorProg<listProgramToProcess.length;iteratorProg++)
			{
				var progRequisitions=customLibrairy.getRequisitionByProgram(listProgramToProcess[iteratorProg],requisitionsList);
				//console.log(progRequisitions.length);
				//console.log("---------------------------------------------------");
				//console.log(progRequisitions);
				for(var iteratorReq=0;iteratorReq<progRequisitions.length;iteratorReq++)
				{
					listRequisitionsBySetProgram.push(progRequisitions[iteratorReq]);
				}
			}
			if(listRequisitionsBySetProgram.length>0)
			{
				winston.info("Requisitions selected based on the  Program ");
				//listRequisitionsBySetProgram=customLibrairy.getRequisitionByProgram(requisitionsList);
				
				//console.log(requisitionLists.length);
				//var builder = require('xmlbuilder');
				var listPayLoad=[];
				var listProductsPresentInTheRequisitons=[];
				listProductsPresentInTheRequisitons=customLibrairy.getAllProductsInRequisition(listRequisitionsBySetProgram);
				//console.log(listProductsPresentInTheRequisitons);
				//Now get the list of all product details in the requisitions
				var stringProductIdsList="";
				for(var iteratorProd=0;iteratorProd<listProductsPresentInTheRequisitons.length;iteratorProd++)
				{
					if(iteratorProd==0)
					{
						stringProductIdsList=stringProductIdsList+listProductsPresentInTheRequisitons[iteratorProd];
					}
					else
					{
						stringProductIdsList=stringProductIdsList+","+listProductsPresentInTheRequisitons[iteratorProd];
					}
					
				}
				var bundleRequest=mediatorConfig.config.hapiServer.url+"/fhir/Basic?_id:in="+stringProductIdsList+"&_format=json&_count="+mediatorConfig.config.resourceCountFhir;
				var temBuildListProduct=[];
				getAllProductsCurl(bundleRequest,temBuildListProduct,function(listProductDetailsInRequisitions)
				{
					//console.log(listProductDetailsInRequisitions[0]);
					//Now loop throup requisitions line to build the adx request
					//Resolve first the related dhis2 id of proogram,product,dispensingunit
					var listCustomRequisitionObjects=customLibrairy.buildObjectDetailsRequisitionList(listRequisitionsBySetProgram,listProductDetailsInRequisitions);
					//console.log(listCustomRequisitionObjects.slice(0,5));
					var listCategoryOptionsToResolve=[];
					for(var iteratorOjectReq=0;iteratorOjectReq<listCustomRequisitionObjects.length;iteratorOjectReq++)
					{
						if(!listCategoryOptionsToResolve.includes(listCustomRequisitionObjects[iteratorOjectReq].product))
						{
							listCategoryOptionsToResolve.push(listCustomRequisitionObjects[iteratorOjectReq].product);
						}
						if(!listCategoryOptionsToResolve.includes(listCustomRequisitionObjects[iteratorOjectReq].program))
						{
							listCategoryOptionsToResolve.push(listCustomRequisitionObjects[iteratorOjectReq].product);
						}
						if(!listCategoryOptionsToResolve.includes(listCustomRequisitionObjects[iteratorOjectReq].dispensingUnit))
						{
							listCategoryOptionsToResolve.push(listCustomRequisitionObjects[iteratorOjectReq].product);
						}
					}
					
					var pathQueryCategoryOptions="";
					for(var iteratorOption=0;iteratorOption< listCategoryOptionsToResolve.length;iteratorOption++)
					{
						if(iteratorOption==0)
						{
							pathQueryCategoryOptions=pathQueryCategoryOptions+listCategoryOptionsToResolve[iteratorOption];
						}
						else
						{
							pathQueryCategoryOptions=pathQueryCategoryOptions+","+listCategoryOptionsToResolve[iteratorOption];
							
						}
					}
					//console.log();
					var orchestrationCategories=[];
					orchestrationCategories.push(
					{ 
						ctxObjectRef: "categoryOptions",
						name: "categoryOptions", 
						domain: mediatorConfig.config.dhis2Server.url,
						path:mediatorConfig.config.dhis2Server.apiPath+"/categoryOptions?fields=id,code&filter=code:in:["+pathQueryCategoryOptions+"]&paging=false",
						params: "",
						body:  "",
						method: "GET",
						headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
					});
					var asyncCategory = require('async');
					var ctxObject2Get = []; 
					var orchestrationsResultsCategory=[];
					//var counterPush=1;
					asyncCategory.each(orchestrationCategories, function(orchestration, callback) {
					var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
					console.log(orchUrl);
					var options={headers:orchestration.headers};
					needle.get(orchUrl,options, function(err, resp) {
						if ( err ){
							winston.error(err);
						}
						orchestrationsResults.push({
						name: orchestration.name,
						request: {
						  path : orchestration.path,
						  headers: orchestration.headers,
						  querystring: orchestration.params,
						  body: "",
						  method: orchestration.method,
						  timestamp: new Date().getTime()
						},
						response: {
						  status: resp.statusCode,
						  body: resp.body,
						  timestamp: new Date().getTime()
						}
						});
						// add orchestration response to context object and return callback
						ctxObject[orchestration.ctxObjectRef] = resp.body;
						callback();
					});//end of needle orchUrl
				},function(err)
				{
			
					if(err)
					{
						winston.error(err);
					}
					winston.info("CategoryOptions resolve");
					var listCategorieOptions=resp.body.categoryOptions;
					if(listCategorieOptions.length>0)
					{
						//Now build adx request
						for(var iteratorReqObject=0;iteratorReqObject<listCustomRequisitionObjects.length;iteratorReqObject++)
						{
							//get Program Id
							var oRequisition=listCustomRequisitionObjects[iteratorReqObject];
							var programId=customLibrairy.getResourceCategoryIdFromCode(oRequisition.program,listCategorieOptions);
							var productId=customLibrairy.getResourceCategoryIdFromCode(oRequisition.product,listCategorieOptions);
							var dispensingUnitId=customLibrairy.getResourceCategoryIdFromCode(oRequisition.dispensingUnit,listCategorieOptions);
							//new build the ADX associated;
						}
					}
					else
					{
						winston.warn("No categoryOptions correspondance found ");
						var urn = mediatorConfig.urn;
						var status = 'Successful';
						var response = {
						  status: 200,
						  headers: {
							'content-type': 'application/json'
						  },
						  body:JSON.stringify( {'OperationResult':'No categoryOptions correspondance found'}),
						  timestamp: new Date().getTime()
						};
						var properties = {};
						properties['Numner requisition pushed'] =0;
						var orchestrationToReturn=[
						{
							name: "requisition2dhis2",
							request: {
							  path :"/requisition2dhis2",
							  headers: {'Content-Type': 'application/json'},
							  querystring: "",
							  body:JSON.stringify( {'Process sync':'succeded'}),
							  method: "GET",
							  timestamp: new Date().getTime()
							},
							response: {
							  status: 200,
							  body:JSON.stringify({'OperationResult':'Not performed'}),
							  timestamp: new Date().getTime()
							}
						}
						];
						var returnObject = {
						  "x-mediator-urn": urn,
						  "status": status,
						  "response": response,
						  "orchestrations": orchestrationToReturn,
						  "properties": properties
						}
						winston.info("End of Hapi=>DHIS2 requisitions orchestration");
						res.set('Content-Type', 'application/json+openhim');
						res.send(returnObject);
						}
					
				});//end asyncCategory
					
					
					
					
					
					
					
					
					
					return;
					//return;
				})//end of getAllProductsCurl
				
				
				
				
				//return;
				
			}//end if listRequisitionsBySetProgram>>0
			else
			{
				//send to the consol the notification for no requisition to process
				winston.warn("No requisition information to push in dhis2");
				var urn = mediatorConfig.urn;
				var status = 'Successful';
				var response = {
				  status: 200,
				  headers: {
					'content-type': 'application/json'
				  },
				  body:JSON.stringify( {'OperationResult':'No requisition information to push in dhis2'}),
				  timestamp: new Date().getTime()
				};
				var properties = {};
				properties['Number of requisition pushed'] =0;
				var orchestrationToReturn=[
				{
					name: "requisitionHapi2Dhis2Sync",
					request: {
					  path :"/dhis/api",
					  headers: {'Content-Type': 'application/json'},
					  querystring: "",
					  body:JSON.stringify( {'Process sync':'succeded'}),
					  method: "POST",
					  timestamp: new Date().getTime()
					},
					response: {
					  status: 200,
					  body:JSON.stringify({'OperationResult':'Not performed'}),
					  timestamp: new Date().getTime()
					}
				}
				];
				var returnObject = {
				  "x-mediator-urn": urn,
				  "status": status,
				  "response": response,
				  "orchestrations": orchestrationToReturn,
				  "properties": properties
				}
				winston.info("End of Hapi=>DHIS2 dispensingunit orchestration");
				res.set('Content-Type', 'application/json+openhim');
				res.send(returnObject);
				
			}//end else. No requisition to process
			
			//return;
		})//end getAllRequisitions
	})//end app.get requisition2dhis2
  return app 
}
//return the list of Organization from fhir based on the filter content
//@@ bundleParam callback parameter for recursive call
//@@filter based on the body contains, using _content=siglcode
//@@ globalStoredList store list of entries in every iterations
function getAllOrganizations(bundleParam,filter,globalStoredList,callback)
{
	
	
	var urlRequest="";
	if(bundleParam=="")
	{
		//urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Organization?type=${level}`;
		var filterAdditional="_count="+mediatorConfig.config.resourceCountFhir;
		urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Organization?${filter}&${filterAdditional}`;
		
		winston.info("First iteration!")
	}
	else
	{
		urlRequest=`${bundleParam}`;
		//console.log(bundleParam);
		winston.info("Looping througth bundle response to build organization list!");
		
	}
	var needle = require('needle');
	needle.defaults(
	{
		open_timeout: 600000
	});
	var headers= {'Content-Type': 'application/json'};
	var options={headers:headers};
	needle.get(urlRequest,options, function(err, resp) {
		if ( err ){
			winston.error("Error occured while looping through bundle to construct the Fhir Organization List");
			callback(err);
		}
		//console.log(resp.statusCode);
		if(resp.statusCode==200)
		{
			
			var responseBundle=JSON.parse(resp.body.toString('utf8'));
			
			//console.log(responseBundle.link);
			if(responseBundle.entry!=null)
			{
				for(var iterator=0;iterator<responseBundle.entry.length;iterator++)
				{
					globalStoredList.push(responseBundle.entry[iterator].resource);
				}
				if(responseBundle.link.length>0)
				{
					//console.log("responsebundle size: "+responseBundle.link.length);
					var hasNextPageBundle=false;
					var iterator=0;
					for(;iterator <responseBundle.link.length;iterator++)
					{
						if(responseBundle.link[iterator].relation=="next")
						{
							
							hasNextPageBundle=true;
							break;
							//GetOrgUnitId(myArr.link[iterator].url,listAssociatedDataRow,listAssociatedResource,callback);
						}
					}
					if(hasNextPageBundle==true)
					{
						console.log();
						console.log("---------------------------------");
						getAllOrganizations(responseBundle.link[iterator].url,filter,globalStoredList,callback);
					}
					else
					{
						 return callback(globalStoredList);
					}
					
				}
			}//end if
		}
	});//end of needle
	
}


//return the list of Products from fhir based on the filter content
//@@ bundleParam callback parameter for recursive call
//@@ globalStoredList store list of entries in every iterations
function getAllProducts(bundleParam,globalStoredList,callback)
{
	
	
	var urlRequest="";
	if(bundleParam=="")
	{
		var filter="code=product&_format=json&_count="+mediatorConfig.config.resourceCountFhir;
		urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Basic?${filter}`;
		
		winston.info("First iteration!")
	}
	else
	{
		urlRequest=`${bundleParam}`;
		//console.log(bundleParam);
		winston.info("Looping througth bundle response to build Product list!");
		
	}
	var needle = require('needle');
	needle.defaults(
	{
		open_timeout: 600000
	});
	var headers= {'Content-Type': 'application/json'};
	var options={headers:headers};
	needle.get(urlRequest,options, function(err, resp) {
		console.log(urlRequest);
		console.log("-------------------------------------------------");
		if ( err ){
			//winston.error("Error occured while looping through bundle to construct the Fhir Product List");
			winston.error(err);
			callback(err);
		}
		//console.log(resp.statusCode);
		if(resp.statusCode==200)
		{
			//console.log(resp.body);
			//var responseBundle=JSON.stringify(resp.body.toString('utf8'));
			var responseBundle=JSON.parse(resp.body.toString('utf8'), null, 4);
			//console.log(responseBundle);
			if(responseBundle.entry!=null)
			{
				for(var iterator=0;iterator<responseBundle.entry.length;iterator++)
				{
					globalStoredList.push(responseBundle.entry[iterator].resource);
				}
				if(responseBundle.link.length>0)
				{
					//console.log("responsebundle size: "+responseBundle.link.length);
					var hasNextPageBundle=false;
					var iterator=0;
					for(;iterator <responseBundle.link.length;iterator++)
					{
						if(responseBundle.link[iterator].relation=="next")
						{
							
							hasNextPageBundle=true;
							break;
							//GetOrgUnitId(myArr.link[iterator].url,listAssociatedDataRow,listAssociatedResource,callback);
						}
					}
					if(hasNextPageBundle==true)
					//if(false)
					{
						//console.log();
						//onsole.log("---------------------------------");
						getAllProducts(responseBundle.link[iterator].url,globalStoredList,callback);
					}
					else
					{
						 return callback(globalStoredList);
					}
					
				}
			}//end if
		}
	});//end of needle
	
}
function getAllProductsCurl(bundleParam,globalStoredList,callback)
{
	var urlRequest="";
	if(bundleParam=="")
	{
		var filter="code=product&_format=json&_count="+mediatorConfig.config.resourceCountFhir;
		urlRequest="'"+`${mediatorConfig.config.hapiServer.url}/fhir/Basic?${filter}`+"'";
	}
	else
	{
		urlRequest="'"+`${bundleParam}`+"'";
		winston.info("Looping througth bundle response to construct requisitions list!");
	}
	console.log(urlRequest);
	var args = "-X GET  -H 'Content-Type: application/fhir+json' "+urlRequest;
	var exec = require('child_process').exec;
	exec('curl ' + args, function (error, stdout, stderr) {
      //console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
        callback(error);
      }
      var responseBundle=JSON.parse(stdout);
		if(responseBundle.entry!=null)
		{
			//console.log("Has entries!!!!!");
			var resourceIndexToRetain=[];
			for(var iterator=0;iterator<responseBundle.entry.length;iterator++)
			{
				//if(esponseBundle.entry[iterator].resource)
				//check if the ressource is already in the globalStoredList
				//console.log("Resource returned :"+responseBundle.entry[iterator].resource.id);
				var itemFound=false;
				for(var itStoreList=0; itStoreList<globalStoredList.length;itStoreList++)
				{
					//console.log(`Compare ${globalStoredList[itStoreList].id} == ${responseBundle.entry[iterator].resource.id}`)
					if(globalStoredList[itStoreList].id==responseBundle.entry[iterator].resource.id)
					{
						
						itemFound=true;
						break;
					}
				}
				//console.log("res :"+itemFound);
				//console.log("******************************************");
				if(!itemFound)
				{
					resourceIndexToRetain.push(iterator);
					//itemFound=false;
				}
				
			}//end for iterator responseBundle
			//Now getall resources retained
			for(var iteratorResource=0;iteratorResource<resourceIndexToRetain.length;iteratorResource++)
			{
				
				var indexToAdd=resourceIndexToRetain[iteratorResource];
				//console.log("id resource retained:"+responseBundle.entry[indexToAdd].resource.id);
				globalStoredList.push(responseBundle.entry[indexToAdd].resource);
			}
			//globalStoredList.push();
			
			if(responseBundle.link.length>0)
			{
				//console.log("responsebundle size: "+responseBundle.link.length);
				var hasNextPageBundle=false;
				var iterator=0;
				var nextPageUrl="";
				//console.log(responseBundle.link);
				//console.log("////////////////////////////////////////////////////////////////////////");
				for(;iterator <responseBundle.link.length;iterator++)
				{
					if(responseBundle.link[iterator].relation=="next")
					{
						
						hasNextPageBundle=true;
						nextPageUrl=responseBundle.link[iterator].url;
						break;
						//GetOrgUnitId(myArr.link[iterator].url,listAssociatedDataRow,listAssociatedResource,callback);
					}
				}
				if(hasNextPageBundle==true)
				//if(false)
				{
					//console.log();
					//onsole.log("---------------------------------");
					getAllProductsCurl(nextPageUrl,globalStoredList,callback);
				}
				else
				{
					 return callback(globalStoredList);
				}
				
			}
		}//end if responseBundle.entry
      //callback();
    });
}


//return the list of Programs from fhir based on the filter content
//@@ bundleParam callback parameter for recursive call
//@@ globalStoredList store list of entries in every iterations
function getAllPrograms(bundleParam,globalStoredList,callback)
{
	
	
	var urlRequest="";
	if(bundleParam=="")
	{
		//var filter="_format=json&_count="+mediatorConfig.config.resourceCountFhir;
		var filter="_format=json&_count="+1;
		urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/OrganizationAffiliation?${filter}`;
		
		winston.info("First iteration!")
	}
	else
	{
		urlRequest=`${bundleParam}`;
		//console.log(bundleParam);
		winston.info("Looping througth bundle response to build program list!");
		
	}
	var needle = require('needle');
	needle.defaults(
	{
		open_timeout: 600000
	});
	var headers= {'Content-Type': 'application/json'};
	var options={headers:headers};
	needle.get(urlRequest,options, function(err, resp) {
		console.log(urlRequest);
		console.log("-------------------------------------------------");
		if ( err ){
			winston.error("Error occured while looping through bundle to construct the Fhir Product List");
			callback(err);
		}
		//console.log(resp.statusCode);
		if(resp.statusCode==200)
		{
			//console.log(resp.body);
			//var responseBundle=JSON.stringify(resp.body.toString('utf8'));
			var responseBundle=JSON.parse(resp.body.toString('utf8'), null, 4);
			//console.log(responseBundle);
			if(responseBundle.entry!=null)
			{
				for(var iterator=0;iterator<responseBundle.entry.length;iterator++)
				{
					globalStoredList.push(responseBundle.entry[iterator].resource);
				}
				if(responseBundle.link.length>0)
				{
					//console.log("responsebundle size: "+responseBundle.link.length);
					var hasNextPageBundle=false;
					var iterator=0;
					for(;iterator <responseBundle.link.length;iterator++)
					{
						if(responseBundle.link[iterator].relation=="next")
						{
							
							hasNextPageBundle=true;
							break;
							//GetOrgUnitId(myArr.link[iterator].url,listAssociatedDataRow,listAssociatedResource,callback);
						}
					}
					if(hasNextPageBundle==true)
					//if(false)
					{
						//console.log();
						//onsole.log("---------------------------------");
						getAllProducts(responseBundle.link[iterator].url,globalStoredList,callback);
					}
					else
					{
						//res.end();
						 return callback(globalStoredList);
					}
					
				}
			}//end if
		}
	});//end of needle
	
}
function getAllProgramsCurl(bundleParam,globalStoredList,callback)
{
	var urlRequest="";
	if(bundleParam=="")
	{
		var filter="_format=json&_count="+1;
		urlRequest="'"+`${mediatorConfig.config.hapiServer.url}/fhir/OrganizationAffiliation?${filter}`+"'";
	}
	else
	{
		urlRequest="'"+`${bundleParam}`+"'";
		winston.info("Looping througth bundle response to construct requisitions list!");
	}
	console.log(urlRequest);
	var args = "-X GET  -H 'Content-Type: application/fhir+json' "+urlRequest;
	var exec = require('child_process').exec;
	exec('curl ' + args, function (error, stdout, stderr) {
      //console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
        callback(error);
      }
      var responseBundle=JSON.parse(stdout);
		if(responseBundle.entry!=null)
		{
			//console.log("Has entries!!!!!");
			var resourceIndexToRetain=[];
			for(var iterator=0;iterator<responseBundle.entry.length;iterator++)
			{
				//if(esponseBundle.entry[iterator].resource)
				//check if the ressource is already in the globalStoredList
				//console.log("Resource returned :"+responseBundle.entry[iterator].resource.id);
				var itemFound=false;
				for(var itStoreList=0; itStoreList<globalStoredList.length;itStoreList++)
				{
					//console.log(`Compare ${globalStoredList[itStoreList].id} == ${responseBundle.entry[iterator].resource.id}`)
					if(globalStoredList[itStoreList].id==responseBundle.entry[iterator].resource.id)
					{
						
						itemFound=true;
						break;
					}
				}
				//console.log("res :"+itemFound);
				//console.log("******************************************");
				if(!itemFound)
				{
					resourceIndexToRetain.push(iterator);
					//itemFound=false;
				}
				
			}//end for iterator responseBundle
			//Now getall resources retained
			for(var iteratorResource=0;iteratorResource<resourceIndexToRetain.length;iteratorResource++)
			{
				
				var indexToAdd=resourceIndexToRetain[iteratorResource];
				//console.log("id resource retained:"+responseBundle.entry[indexToAdd].resource.id);
				globalStoredList.push(responseBundle.entry[indexToAdd].resource);
			}
			//globalStoredList.push();
			
			if(responseBundle.link.length>0)
			{
				//console.log("responsebundle size: "+responseBundle.link.length);
				var hasNextPageBundle=false;
				var iterator=0;
				var nextPageUrl="";
				//console.log(responseBundle.link);
				//console.log("////////////////////////////////////////////////////////////////////////");
				for(;iterator <responseBundle.link.length;iterator++)
				{
					if(responseBundle.link[iterator].relation=="next")
					{
						
						hasNextPageBundle=true;
						nextPageUrl=responseBundle.link[iterator].url;
						break;
						//GetOrgUnitId(myArr.link[iterator].url,listAssociatedDataRow,listAssociatedResource,callback);
					}
				}
				if(hasNextPageBundle==true)
				//if(false)
				{
					//console.log();
					//onsole.log("---------------------------------");
					getAllProgramsCurl(nextPageUrl,globalStoredList,callback);
				}
				else
				{
					 return callback(globalStoredList);
				}
				
			}
		}//end if responseBundle.entry
      //callback();
    });
}




//return the list of Requisitions based on the startPeriod and endPeriod from fhir based on the filter content
//@@ bundleParam callback parameter for recursive call
//@@ globalStoredList store list of entries in every iterations
function getAllRequisitions(bundleParam,globalStoredList,callback)
{
	
	
	var urlRequest="";
	if(bundleParam=="")
	{
		var startDate=mediatorConfig.config.periodStartDate;
		var endDate=mediatorConfig.config.periodEndDate;
		//var filter="code=requisition&_format=json&_count="+mediatorConfig.config.resourceCountFhir+"&created=>="+startDate+"&created=<="+endDate;
		var filter="code=requisition&_count=1"+"&created=>="+startDate+"&created=<="+endDate;
		urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Basic?${filter}`;
		
		winston.info("First iteration!")
	}
	else
	{
		urlRequest=`${bundleParam}`;
		//console.log(bundleParam);
		winston.info("Looping througth bundle response to build Product list!");
		
	}
	var needle = require('needle');
	needle.defaults(
	{
		open_timeout: 600000
	});
	var headers= {'Content-Type': 'application/json'};
	var options={headers:headers};
	needle.get(urlRequest,options, function(err, resp) {
		console.log(urlRequest);
		console.log("-------------------------------------------------");
		if ( err ){
			//winston.error("Error occured while looping through bundle to construct the Fhir Product List");
			winston.error(err);
			callback(err);
		}
		//console.log(resp.statusCode);
		if(resp.statusCode==200)
		{
			console.log(resp.body);
			//var responseBundle=JSON.stringify(resp.body.toString('utf8'));
			var responseBundle=JSON.parse(resp.body.toString('utf8'), null, 4);
			//console.log(responseBundle);
			if(responseBundle.entry!=null)
			{
				for(var iterator=0;iterator<responseBundle.entry.length;iterator++)
				{
					globalStoredList.push(responseBundle.entry[iterator].resource);
				}
				if(responseBundle.link.length>0)
				{
					//console.log("responsebundle size: "+responseBundle.link.length);
					var hasNextPageBundle=false;
					var iterator=0;
					for(;iterator <responseBundle.link.length;iterator++)
					{
						if(responseBundle.link[iterator].relation=="next")
						{
							
							hasNextPageBundle=true;
							break;
							//GetOrgUnitId(myArr.link[iterator].url,listAssociatedDataRow,listAssociatedResource,callback);
						}
					}
					if(hasNextPageBundle==true)
					//if(false)
					{
						//console.log();
						//onsole.log("---------------------------------");
						getAllRequisitions(responseBundle.link[iterator].url,globalStoredList,callback);
					}
					else
					{
						 return callback(globalStoredList);
					}
					
				}
			}//end if
		
		}
	});//end of needle
	
}
function getAllRequisitionsXHttpRequest(bundleParam,globalStoredList,callback)
{
	var urlRequest="";
	if(bundleParam=="")
	{
		var startDate=mediatorConfig.config.periodStartDate;
		var endDate=mediatorConfig.config.periodEndDate;
		var filter="code=requisition&_format=json&_count="+mediatorConfig.config.resourceCountFhir+"&created=>="+startDate+"&created=<="+endDate;
		//var filter="code=requisition&_count=1"+"&created=>="+startDate+"&created=<="+endDate;
		urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Basic?${filter}`;
		
		winston.info("First iteration!")
	}
	else
	{
		urlRequest=`${bundleParam}`;
		//console.log(bundleParam);
		winston.info("Looping througth bundle response to build Product list!");
		
	}
	var request = new XMLHttpRequest();
	request.open('GET',urlRequest, true);
	console.log(urlRequest);
	request.setRequestHeader( 'Content-Type','application/fhir+json' );
	request.setRequestHeader( 'Accept','application/fhir+json' ); 
	request.onreadystatechange = function() {
		//console.log("Status:"+this.status);
		//console.log("Status:"+this.readyState);
		if (this.readyState == 4 && this.status == 200) {
			//var responseBundle=JSON.parse(this.responseText);
			console.log(this.response);
			if(responseBundle.entry!=null)
			{
				for(var iterator=0;iterator<responseBundle.entry.length;iterator++)
				{
					globalStoredList.push(responseBundle.entry[iterator].resource);
				}
				if(responseBundle.link.length>0)
				{
					//console.log("responsebundle size: "+responseBundle.link.length);
					var hasNextPageBundle=false;
					var iterator=0;
					for(;iterator <responseBundle.link.length;iterator++)
					{
						if(responseBundle.link[iterator].relation=="next")
						{
							
							hasNextPageBundle=true;
							break;
							//GetOrgUnitId(myArr.link[iterator].url,listAssociatedDataRow,listAssociatedResource,callback);
						}
					}
					if(hasNextPageBundle==true)
					//if(false)
					{
						//console.log();
						//onsole.log("---------------------------------");
						getAllRequisitionsXHttpRequest(responseBundle.link[iterator].url,globalStoredList,callback);
					}
					else
					{
						 return callback(globalStoredList);
					}
					
				}
			}//end if
		
		}
	}
	request.send();
}
function getAllRequisitionsCurl(bundleParam,globalStoredList,callback)
{
	var urlRequest="";
	if(bundleParam=="")
	{
		var startDate=mediatorConfig.config.periodStartDate;
		var endDate=mediatorConfig.config.periodEndDate;
		var filter="code=requisition&_format=json&_count="+mediatorConfig.config.resourceCountFhir+"&created=>="+startDate+"&created=<="+endDate;
		urlRequest="'"+`${mediatorConfig.config.hapiServer.url}/fhir/Basic?${filter}`+"'";
	}
	else
	{
		urlRequest=`${bundleParam}`;
		winston.info("Looping througth bundle response to construct requisitions list!");
	}
	console.log(urlRequest);
	var args = "-X GET  -H 'Content-Type: application/fhir+json' "+urlRequest;
	var exec = require('child_process').exec;
	exec('curl ' + args, function (error, stdout, stderr) {
      //console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
        callback(error);
      }
      var responseBundle=JSON.parse(stdout);
		if(responseBundle.entry!=null)
		{
			var resourceIndexToRetain=[];
			for(var iterator=0;iterator<responseBundle.entry.length;iterator++)
			{
				//if(esponseBundle.entry[iterator].resource)
				//check if the ressource is already in the globalStoredList
				//console.log("Resource returned :"+responseBundle.entry[iterator].resource.id);
				var itemFound=false;
				for(var itStoreList=0; itStoreList<globalStoredList.length;itStoreList++)
				{
					//console.log(`Compare ${globalStoredList[itStoreList].id} == ${responseBundle.entry[iterator].resource.id}`)
					if(globalStoredList[itStoreList].id==responseBundle.entry[iterator].resource.id)
					{
						
						itemFound=true;
						break;
					}
				}
				//console.log("res :"+itemFound);
				//console.log("******************************************");
				if(!itemFound)
				{
					resourceIndexToRetain.push(iterator);
					//itemFound=false;
				}
				
			}//end for iterator responseBundle
			//Now getall resources retained
			for(var iteratorResource=0;iteratorResource<resourceIndexToRetain.length;iteratorResource++)
			{
				
				var indexToAdd=resourceIndexToRetain[iteratorResource];
				//console.log("id resource retained:"+responseBundle.entry[indexToAdd].resource.id);
				globalStoredList.push(responseBundle.entry[indexToAdd].resource);
			}
			//globalStoredList.push();
			
			if(responseBundle.link.length>0)
			{
				//console.log("responsebundle size: "+responseBundle.link.length);
				var hasNextPageBundle=false;
				var iterator=0;
				var nextPageUrl="";
				for(;iterator <responseBundle.link.length;iterator++)
				{
					if(responseBundle.link[iterator].relation=="next")
					{
						
						hasNextPageBundle=true;
						nextPageUrl=responseBundle.link[iterator].url;
						break;
						//GetOrgUnitId(myArr.link[iterator].url,listAssociatedDataRow,listAssociatedResource,callback);
					}
				}
				if(hasNextPageBundle==true)
				//if(false)
				{
					//console.log();
					//onsole.log("---------------------------------");
					getAllRequisitionsCurl(nextPageUrl,globalStoredList,callback);
				}
				else
				{
					 return callback(globalStoredList);
				}
				
			}
		}//end if responseBundle.entry
      //callback();
    });
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  if (apiConf.api.trustSelfSigned) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        winston.error('Failed to register this mediator, check your config')
        winston.error(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        winston.info('Received initial config:')
        winston.info(JSON.stringify(newConfig))
        config = newConfig
        if (err) {
          winston.error('Failed to fetch initial config')
          winston.error(err.stack)
          process.exit(1)
        } else {
          winston.info('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              let configEmitter = medUtils.activateHeartbeat(apiConf.api)
              configEmitter.on('config', (newConfig) => {
                winston.info('Received updated config:')
                winston.info(JSON.stringify(newConfig))
                // set new config for mediator
                config = newConfig

                // we can act on the new config received from the OpenHIM here
                winston.info(config)
              })
            }
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let app = setupApp()
    const server = app.listen(port, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info(`Listening on ${port}...`))
}
