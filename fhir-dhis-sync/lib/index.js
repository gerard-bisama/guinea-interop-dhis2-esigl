#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const winston = require('winston')
const customLibrairy=require('./lib.js');

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
  var needle = require('needle');
  var async = require('async');
  var btoa = require('btoa');
  
    
	app.get('/product2dhsi2', (req, res) => {
		needle.defaults(
		{
			open_timeout: 600000
		});
		//console.log("Entered ....!");
		console.log("Start hapi=>dhis2 products sync...!");
		const basicClientToken = `Basic ${btoa(mediatorConfig.config.dhis2Server.username+':'+mediatorConfig.config.dhis2Server.password)}`;
		//Get Product list from hapi
		var globalStoredList=[];
		getAllProducts("",globalStoredList,function(productLists)
		{
			winston.info("Product resources returned from Fhir..");
			//console.log(JSON.stringify(productLists[0]));
			//return;
			var orchestrationsProducts2Push=[];
			productLists[0].extension[0].extension[0].url
			
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
					shortName:productName,
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
					if(operationResponse.body.httpStatus=="Created")
					{
						listProductIdCreated.push(operationResponse.body.response.uid);
						winston.info("Product: "+productCode+" created with id = "+operationResponse.body.response.uid);
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
					for(var iteratorCol=0;iteratorCol<listProductIdCreated.length;iteratorCol++)
					{
						ochestrationProductCollection.push(
						{ 
							ctxObjectRef: listProductIdCreated[iteratorCol],
							name: listProductIdCreated[iteratorCol], 
							domain: mediatorConfig.config.dhis2Server.url,
							path:mediatorConfig.config.dhis2Server.apiPath+"/categories/"+"eXSyxUjuR0Z"+"/categoryOptions/"+listProductIdCreated[iteratorCol],
							params: "",
							body:  "",
							method: "POST",
							headers: {'Content-Type': 'application/json','Authorization': basicClientToken}
					  });
					}
					var asyncProductCollection = require('async');
					var ctxObject2Update = []; 
					var orchestrationsResultsCollections=[];
					var counterCollection=1;
					
					asyncProductCollection.each(ochestrationProductCollection, function(orchestrationCollection, callbackCollection) {
						var orchUrl = orchestrationCollection.domain + orchestrationCollection.path + orchestrationCollection.params;
						var options={
							headers:orchestrationCollection.headers
							};
							needle.post(orchUrl,{},options, function(err, resp) {
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
								ctxObject2Update[orchestrationCollection.ctxObjectRef] = resp.body;
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
							for(var iteratorResp=0;iteratorResp<orchestrationsResultsCollections.length;iteratorResp++)
							{
								console.log(orchestrationsResultsCollections[iteratorResp].response);
							}
						});//end of asyncProductCollection.each 
				}
				else
				{
					winston.warn("No product to assign to the category");
				}
				
			});//end of asyncProduct2Push
		
		});//end of getAllProducts
		
		
	})//end of app.get /product2dhsi2
	
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
		urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Organization?_count=10&${filter}`;
		
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
		var filter="code=product&_format=json&_count=4";
		urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Basic?${filter}`;
		
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
					//if(hasNextPageBundle==true)
					if(false)
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
