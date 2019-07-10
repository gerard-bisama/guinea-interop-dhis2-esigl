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
  
    
	app.get('/syncorgunit2fhir', (req, res) => {
		needle.defaults(
		{
			open_timeout: 600000
		});
		//console.log("Entered ....!");
		console.log("Start dhis2=>hapi facility sync...!");
		const basicClientToken = `Basic ${btoa(mediatorConfig.config.dhis2Server.username+':'+mediatorConfig.config.dhis2Server.password)}`;
		//console.log(basicClientToken);
		var orchestrations=[];
		orchestrations = [{ 
			ctxObjectRef: "OrgUnits",
			name: "Get orgunits from dhis2", 
			domain: mediatorConfig.config.dhis2Server.url,
			path: mediatorConfig.config.dhis2Server.orgunitapipath,
			params: "",
			body: "",
			method: "GET",
			headers: {'Authorization': basicClientToken}
		  }];
		var ctxObject = []; 
		var orchestrationsResults=[]; 
		async.each(orchestrations, function(orchestration, callback) {
		// code to execute the orchestrations
		// construct the URL to request
		var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
		//console.log(orchUrl);
		var options={headers:orchestration.headers};
		//console.log(options);
		needle.get(orchUrl,options, function(err, resp) {
		// if error occured
		if ( err ){
			callback(err);
		}
		//console.log(orchestration.headers);
	  // add new orchestration to object
	  //orchestration.body.organisationUnits, removed it in the boby attribute to force to change the results transaction logs
		orchestrationsResults.push({
		name: orchestration.name,
		request: {
		  path : orchestration.path,
		  headers: orchestration.headers,
		  querystring: orchestration.params,
		  body: orchestration.body.organisationUnits,
		  method: orchestration.method,
		  timestamp: new Date().getTime()
		},
		response: {
		  status: resp.statusCode,
		  body: JSON.stringify(resp.body.organisationUnits, null, 4),
		  timestamp: new Date().getTime()
		}
		});
		// add orchestration response to context object and return callback
		ctxObject[orchestration.ctxObjectRef] = resp.body.organisationUnits;
		callback();
		});//end of needle orchUrl
		}, function(err){

			// This section will execute once all requests have been completed
			console.log("dhis2 Orgunits extracted... ");
			var urn = mediatorConfig.urn;
			var status = 'Successful';
			//JSON.stringify(ctxObject.OrgUnits, null, 4) //This is the listof orgunit and we dont want to store it in the openhim transaction log, replaced the body
			var response = {
			  status: 200,
			  headers: {
				'content-type': 'application/json'
			  },
			  body:JSON.stringify( {'resquestResult':'success'}),
			  timestamp: new Date().getTime()
			};
			// construct property data to be returned
			var properties = {};
			properties['Nombre orgunits extraites'] = ctxObject.OrgUnits.length;
			console.log("OrgUnits extracted :"+ ctxObject.OrgUnits.length);
			//console.log(ctxObject.OrgUnits.slice(0,10));
			//var organizationBundle=customLibrairy.buildOrganizationHierarchy( ctxObject.OrgUnits.slice(13,15));
			var organizationBundle=customLibrairy.buildOrganizationHierarchy( ctxObject.OrgUnits);
			console.log("Transform orgunit list to FHIR Bundle. Total entry :"+organizationBundle.entry.length);
			var listOrganizationLevel1=customLibrairy.getOrganizationByLevel("level_1",organizationBundle.entry);
			console.log("Process Organization level 1. Nbr of entities :"+listOrganizationLevel1.length);
			//console.log(JSON.stringify(listOrganizationLevel1));
			//return;
			//console.log(JSON.stringify(organizationBundle));
			//Build orchestration request for pushing organization to fhir
			var orchestrations2Fhir=[];
			
			for(var i=0;i<listOrganizationLevel1.length;i++)
			{
				var oOrganization=listOrganizationLevel1[i];
				orchestrations2Fhir.push({ 
				ctxObjectRef: "organisation_"+i,
				name: "push orgnization for fhir ", 
				domain: mediatorConfig.config.hapiServer.url,
				path: "/fhir/Organization/"+oOrganization.id,
				params: "",
				body:  JSON.stringify(oOrganization),
				method: "PUT",
				headers: {'Content-Type': 'application/json'}
				});
			}
			//console.log(JSON.stringify(orchestrations2Fhir));
			//return;
			var async2Fhir = require('async');
			var ParamsLevel1ToTransfertToAsyncSession=
			{
				"ctxObject2Fhir":[],
				"orchestrationsResults2Fhir":[],
				"OrganizationBundleEntry":organizationBundle.entry
			}
			var ctxObject2Fhir = []; 
			var orchestrationsResults2Fhir=[]; 
			var counter=1;
			async2Fhir.each(orchestrations2Fhir, function(orchestration2Fhir, callbackFhir) {
				var orchUrl = orchestration2Fhir.domain + orchestration2Fhir.path + orchestration2Fhir.params;
				var options={headers:orchestration2Fhir.headers};
				var organizationToPush=orchestration2Fhir.body;
				needle.put(orchUrl,organizationToPush,{json:true}, function(err, resp) {
					// if error occured
					if ( err ){
						console.log("********************Error neeble sync OrganizationLevel1********************************");
						callbackFhir(err);
					}
					//console.log(orchestration.headers);
				  // add new orchestration to object
				  //orchestration.body.organisationUnits, removed it in the boby attribute to force to change the results transaction logs
				  //console.log("----------------------Response-------------------------------");
				  //console.log(JSON.stringify(resp.body.toString('utf8')));
					console.log(counter+"/"+orchestrations2Fhir.length);
					console.log("...Inserting "+orchestration2Fhir.path);
					orchestrationsResults2Fhir.push({
					name: orchestration2Fhir.name,
					request: {
					  path : orchestration2Fhir.path,
					  headers: orchestration2Fhir.headers,
					  querystring: orchestration2Fhir.params,
					  body: orchestration2Fhir.body,
					  method: orchestration2Fhir.method,
					  timestamp: new Date().getTime()
					},
					response: {
					  status: resp.statusCode,
					  body: JSON.stringify(resp.body.toString('utf8'), null, 4), //convert response fron byte to string plain text
					  timestamp: new Date().getTime()
					}
					
					});
					// add orchestration response to context object and return callback
					ctxObject2Fhir[orchestration2Fhir.ctxObjectRef] = resp.body.toString('utf8');
					counter++;
					callbackFhir();
				});
				
				
			}, function(err){
				var urn = mediatorConfig.urn;
				var status = 'Successful';
				//JSON.stringify(ctxObject.OrgUnits, null, 4) //This is the listof orgunit and we dont want to store it in the openhim transaction log, replaced the body
				var response = {
				  status: 200,
				  headers: {
					'content-type': 'application/json'
				  },
				  body:JSON.stringify( {'resquestResultToFhir':'success'}),
				  timestamp: new Date().getTime()
				};
				var properties = {};
				properties['Nombre organization maj'] =ctxObject2Fhir.length;
				var listOrganizationLevel2=customLibrairy.getOrganizationByLevel("level_2",organizationBundle.entry);
				console.log("Process Organization level 2. Nbr of entities :"+listOrganizationLevel2.length);
				//console.log("-------------------------------Org Level2---------------------------------------------");
				//console.log(listOrganizationLevel2);
				var orchestrations2FhirLevel2=[];
			
				for(var i=0;i<listOrganizationLevel2.length;i++)
				{
					var oOrganization=listOrganizationLevel2[i];
					orchestrations2FhirLevel2.push({ 
					ctxObjectRef: "organisation_"+i,
					name: "push orgnization for fhir ", 
					domain: mediatorConfig.config.hapiServer.url,
					path: "/fhir/Organization/"+oOrganization.id,
					params: "",
					body:  JSON.stringify(oOrganization),
					method: "PUT",
					headers: {'Content-Type': 'application/json'}
					});
				}
				//console.log(JSON.stringify(orchestrations2FhirLevel2));
				//return;
				var async2FhirLevel2 = require('async');
				var ctxObject2FhirLevel2 = []; 
				var orchestrationsResults2FhirLevel2=[];
				counter=1; 
				async2FhirLevel2.each(orchestrations2FhirLevel2, function(orchestration2FhirLevel2, callbackFhirLevel2) {
					var orchUrl = orchestration2FhirLevel2.domain + orchestration2FhirLevel2.path + orchestration2FhirLevel2.params;
					var options={headers:orchestration2FhirLevel2.headers};
					var organizationToPush=orchestration2FhirLevel2.body;
					needle.put(orchUrl,organizationToPush,{json:true}, function(err, resp) {
						// if error occured
						if ( err ){
							console.log("********************Error neeble sync OrganizationLevel2********************************");
							callbackFhirLevel2(err);
						}
						//console.log(orchestration.headers);
					  // add new orchestration to object
					  //orchestration.body.organisationUnits, removed it in the boby attribute to force to change the results transaction logs
					  //console.log("----------------------Response-------------------------------");
					  //console.log(JSON.stringify(resp.body.toString('utf8')));
						console.log(counter+"/"+orchestrations2FhirLevel2.length);
						console.log("...Inserting "+orchestration2FhirLevel2.path);
						orchestrationsResults2FhirLevel2.push({
						name: orchestration2FhirLevel2.name,
						request: {
						  path : orchestration2FhirLevel2.path,
						  headers: orchestration2FhirLevel2.headers,
						  querystring: orchestration2FhirLevel2.params,
						  body: orchestration2FhirLevel2.body,
						  method: orchestration2FhirLevel2.method,
						  timestamp: new Date().getTime()
						},
						response: {
						  status: resp.statusCode,
						  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
						  timestamp: new Date().getTime()
						}
						});
						// add orchestration response to context object and return callback
						ctxObject2FhirLevel2[orchestration2FhirLevel2.ctxObjectRef] = resp.body.toString('utf8');
						counter++;
						callbackFhirLevel2();
						
					});
					
				}, function(err){
					var urn = mediatorConfig.urn;
					var status = 'Successful';
					//JSON.stringify(ctxObject.OrgUnits, null, 4) //This is the listof orgunit and we dont want to store it in the openhim transaction log, replaced the body
					var response = {
					  status: 200,
					  headers: {
						'content-type': 'application/json'
					  },
					  body:JSON.stringify( {'resquestResultToFhirLevel2':'success'}),
					  timestamp: new Date().getTime()
					};
					var properties = {};
					properties['Nombre organization maj'] =ctxObject2FhirLevel2.length;
					var listOrganizationLevel3=customLibrairy.getOrganizationByLevel("level_3",organizationBundle.entry);
					console.log("Process Organization level 3. Nbr of entities :"+listOrganizationLevel3.length);
					//console.log("-------------------------------Org Level3---------------------------------------------");
				    //console.log(listOrganizationLevel3);
				    var orchestrations2FhirLevel3=[];
					for(var i=0;i<listOrganizationLevel3.length;i++)
					{
						var oOrganization=listOrganizationLevel3[i];
						orchestrations2FhirLevel3.push({ 
						ctxObjectRef: "organisation_"+i,
						name: "push orgnization for fhir ", 
						domain: mediatorConfig.config.hapiServer.url,
						path: "/fhir/Organization/"+oOrganization.id,
						params: "",
						body:  JSON.stringify(oOrganization),
						method: "PUT",
						headers: {'Content-Type': 'application/json'}
						});
					}
					//console.log(JSON.stringify(orchestrations2FhirLevel2));
					//return;
					var async2FhirLevel3 = require('async');
					var ctxObject2FhirLevel3 = []; 
					var orchestrationsResults2FhirLevel3=[];
					counter=1;
					async2FhirLevel3.each(orchestrations2FhirLevel3, function(orchestration2FhirLevel3, callbackFhirLevel3) {
						var orchUrl = orchestration2FhirLevel3.domain + orchestration2FhirLevel3.path + orchestration2FhirLevel3.params;
						var options={headers:orchestration2FhirLevel3.headers};
						var organizationToPush=orchestration2FhirLevel3.body;
						needle.put(orchUrl,organizationToPush,{json:true}, function(err, resp) {
							// if error occured
							if ( err ){
								console.log("********************Error neeble sync OrganizationLevel3********************************");
								callbackFhirLevel3(err);
							}
							console.log(counter+"/"+orchestrations2FhirLevel3.length);
							console.log("...Inserting "+orchestration2FhirLevel3.path);
							orchestrationsResults2FhirLevel3.push({
							name: orchestrationsResults2FhirLevel3.name,
							request: {
							  path : orchestration2FhirLevel3.path,
							  headers: orchestration2FhirLevel3.headers,
							  querystring: orchestration2FhirLevel3.params,
							  body: orchestration2FhirLevel3.body,
							  method: orchestration2FhirLevel3.method,
							  timestamp: new Date().getTime()
							},
							response: {
							  status: resp.statusCode,
							  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
							  timestamp: new Date().getTime()
							}
							});
							// add orchestration response to context object and return callback
							ctxObject2FhirLevel3[orchestration2FhirLevel3.ctxObjectRef] = resp.body.toString('utf8');
							counter++;
							callbackFhirLevel3();
						});
						
					
				},function(err){
					var urn = mediatorConfig.urn;
					var status = 'Successful';
					//JSON.stringify(ctxObject.OrgUnits, null, 4) //This is the listof orgunit and we dont want to store it in the openhim transaction log, replaced the body
					var response = {
					  status: 200,
					  headers: {
						'content-type': 'application/json'
					  },
					  body:JSON.stringify( {'resquestResultToFhirLevel3':'success'}),
					  timestamp: new Date().getTime()
					};
					var properties = {};
					properties['Nombre organization maj'] =ctxObject2FhirLevel3.length;
					var listOrganizationLevel4=customLibrairy.getOrganizationByLevel("level_4",organizationBundle.entry);
					console.log("Process Organization level 4. Nbr of entities :"+listOrganizationLevel4.length);
					//console.log("-------------Breakpoint level4--------------");
					//return;
					var orchestrations2FhirLevel4=[];
					for(var i=0;i<listOrganizationLevel4.length;i++)
					{
						var oOrganization=listOrganizationLevel4[i];
						orchestrations2FhirLevel4.push({ 
						ctxObjectRef: "organisation_"+i,
						name: "push orgnization for fhir ", 
						domain: mediatorConfig.config.hapiServer.url,
						path: "/fhir/Organization/"+oOrganization.id,
						params: "",
						body:  JSON.stringify(oOrganization),
						method: "PUT",
						headers: {'Content-Type': 'application/json'}
						});
					}
					//console.log(JSON.stringify(orchestrations2FhirLevel2));
					//return;
					var async2FhirLevel4 = require('async');
					var ctxObject2FhirLevel4 = []; 
					var orchestrationsResults2FhirLevel4=[];
					counter=1;
					async2FhirLevel4.each(orchestrations2FhirLevel4, function(orchestration2FhirLevel4, callbackFhirLevel4) {
						var orchUrl = orchestration2FhirLevel4.domain + orchestration2FhirLevel4.path + orchestration2FhirLevel4.params;
						var options={headers:orchestration2FhirLevel4.headers};
						var organizationToPush=orchestration2FhirLevel4.body;
						needle.put(orchUrl,organizationToPush,{json:true}, function(err, resp) {
							// if error occured
							if ( err ){
								console.log("********************Error neeble sync OrganizationLevel4********************************");
								callbackFhirLevel4(err);
							}
							console.log(counter+"/"+orchestrations2FhirLevel4.length);
							console.log("...Inserting "+orchestration2FhirLevel4.path);
							orchestrationsResults2FhirLevel4.push({
							name: orchestration2FhirLevel4.name,
							request: {
							  path : orchestration2FhirLevel4.path,
							  headers: orchestration2FhirLevel4.headers,
							  querystring: orchestration2FhirLevel4.params,
							  body: orchestration2FhirLevel4.body,
							  method: orchestration2FhirLevel4.method,
							  timestamp: new Date().getTime()
							},
							response: {
							  status: resp.statusCode,
							  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
							  timestamp: new Date().getTime()
							}
							});
							// add orchestration response to context object and return callback
							ctxObject2FhirLevel4[orchestration2FhirLevel4.ctxObjectRef] = resp.body.toString('utf8');
							counter++;
							callbackFhirLevel4();
						});
						
					
					},function(err){
						var urn = mediatorConfig.urn;
						var status = 'Successful';
						var response = {
						  status: 200,
						  headers: {
							'content-type': 'application/json'
						  },
						  body:JSON.stringify( {'resquestResultToFhirLevel4':'success'}),
						  timestamp: new Date().getTime()
						};
						var properties = {};
						properties['Nombre organization maj'] =ctxObject2FhirLevel4.length;
						var listOrganizationLevel5=customLibrairy.getOrganizationByLevel("level_5",organizationBundle.entry);
						console.log("Process Organization level 5. Nbr of entities :"+listOrganizationLevel5.length);
						//console.log(JSON.stringify(listOrganizationLevel5));
						//console.log("-------------Breakpoint level5--------------");
						//return;
						if(listOrganizationLevel5.length>0){
							var orchestrations2FhirLevel5=[];
							for(var i=0;i<listOrganizationLevel5.length;i++)
							{
								var oOrganization=listOrganizationLevel5[i];
								orchestrations2FhirLevel5.push({ 
								ctxObjectRef: "organisation_"+i,
								name: "push orgnization for fhir ", 
								domain: mediatorConfig.config.hapiServer.url,
								path: "/fhir/Organization/"+oOrganization.id,
								params: "",
								body:  JSON.stringify(oOrganization),
								method: "PUT",
								headers: {'Content-Type': 'application/json'}
								});
							}
							
							var async2FhirLevel5 = require('async');
							var ctxObject2FhirLevel5 = []; 
							var orchestrationsResults2FhirLevel5=[];
							counter=1;
							async2FhirLevel5.each(orchestrations2FhirLevel5, function(orchestration2FhirLevel5, callbackFhirLevel5) {
								var orchUrl = orchestration2FhirLevel5.domain + orchestration2FhirLevel5.path + orchestration2FhirLevel5.params;
								var options={headers:orchestration2FhirLevel5.headers};
								var organizationToPush=orchestration2FhirLevel5.body;
								needle.put(orchUrl,organizationToPush,{json:true}, function(err, resp) {
									// if error occured
									if ( err ){
										console.log("********************Error neeble sync OrganizationLevel5********************************");
										callbackFhirLevel5(err);
									}
									console.log(counter+"/"+orchestrations2FhirLevel5.length);
									console.log("...Inserting "+orchestration2FhirLevel5.path);
									orchestrationsResults2FhirLevel5.push({
									name: orchestration2FhirLevel5.name,
									request: {
									  path : orchestration2FhirLevel5.path,
									  headers: orchestration2FhirLevel5.headers,
									  querystring: orchestration2FhirLevel5.params,
									  body: orchestration2FhirLevel5.body,
									  method: orchestration2FhirLevel5.method,
									  timestamp: new Date().getTime()
									},
									response: {
									  status: resp.statusCode,
									  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
									  timestamp: new Date().getTime()
									}
									});
									// add orchestration response to context object and return callback
									ctxObject2FhirLevel5[orchestration2FhirLevel5.ctxObjectRef] = resp.body.toString('utf8');
									counter++;
									callbackFhirLevel5();
								});
								
						
							},function(err){
								var urn = mediatorConfig.urn;
								var status = 'Successful';
								var response = {
								  status: 200,
								  headers: {
									'content-type': 'application/json'
								  },
								  body:JSON.stringify( {'resquestResultToFhirLevel5':'success'}),
								  timestamp: new Date().getTime()
								};
								var properties = {};
								properties['Nombre organization maj'] =ctxObject2FhirLevel5.length;
								var returnObject = {
								  "x-mediator-urn": urn,
								  "status": status,
								  "response": response,
								  "orchestrations": orchestrationsResults2FhirLevel5,
								  "properties": properties
								}
								console.log("********************Fin de la synchronisation DHIS2=>FHIR***********************************");
								res.set('Content-Type', 'application/json+openhim');
								res.send(returnObject);
							});//end of async2FhirLevel5.each
							
						}//end of if listOrganizationLevel5.length
						else
						{
							var urn = mediatorConfig.urn;
							var status = 'Successful';
							var response = {
							  status: 200,
							  headers: {
								'content-type': 'application/json'
							  },
							  body:JSON.stringify( {'resquestResultToFhirLevel4':'success'}),
							  timestamp: new Date().getTime()
							};
							var properties = {};
							properties['Nombre organization maj'] =ctxObject2FhirLevel4.length;
							var returnObject = {
							  "x-mediator-urn": urn,
							  "status": status,
							  "response": response,
							  "orchestrations": orchestrationsResults2FhirLevel4,
							  "properties": properties
							}
							console.log("********************Fin de la synchronisation DHIS2=>FHIR***********************************");
							res.set('Content-Type', 'application/json+openhim');
							res.send(returnObject);
						}
					});//end of async2FhirLevel4.each
					
				});//end of async2FhirLevel3.each
					
				});//end of async2FhirLevel2.each
				
				
				//return;
				/*
				var returnObject = {
				  "x-mediator-urn": urn,
				  "status": status,
				  "response": response,
				  "orchestrations": orchestrationsResults2Fhir,
				  "properties": properties
				}
				// set content type header so that OpenHIM knows how to handle the response
				//res.set('Content-Type', 'application/json+openhim');
				res.set('Content-Type', 'application/json+openhim');
				res.send(returnObject);*/
				 if (err){
					console.log("********************Error async: Sync organization level 2********************************");
					console.log(err)
					//return;
				  }
			});//end of each orchestrationfhir
			
			//orchestration to push the list of organisation to fhir
			
			// construct returnObject to be returned
			//orchestrationsResults, limited to 10 object only
			//orchestrationsResults[0].body=JSON.stringify( ctxObject.OrgUnits.slice(0,1));
			/*
			var returnObject = {
			  "x-mediator-urn": urn,
			  "status": status,
			  "response": response,
			  "orchestrations": orchestrationsResults,
			  "properties": properties
			}
			res.set('Content-Type', 'application/json');
			res.send(returnObject);
			// if any errors occurred during a request the print out the error and stop processing
			*/
			if (err){
				console.log(err)
			//return;
			}
		});//end of asyn.each orchestrations
	
	})//end of app.get /syncorgunit2fhir
	
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
		urlRequest=`${mediatorConfig.config.hapiServer.url}/fhir/Organization?${filter}`;
		
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
			
			var responseBundle=JSON.parse(resp.body.toString('utf8'))
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
