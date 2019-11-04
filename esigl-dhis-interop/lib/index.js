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

var port = process.env.NODE_ENV === 'test' ? 7001 : mediatorConfig.endpoints[0].port

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
		const basicClientToken = `Basic ${btoa(config.dhis2Server.username+':'+config.dhis2Server.password)}`;
		//console.log(basicClientToken);
		var _currentDateOperation=new Date();
		var _dateOperation=_currentDateOperation.toJSON().split("T")[0];
		customLibrairy.getSyncLogFacility(_dateOperation,function(syncRecord)
		{
			//console.log(syncRecord);
			var _pageSize=0;
			var _currentPage=0;
			var _pageCount=0;
			var requestOrgUnits="";
			if(syncRecord==null)//sync on going on the specified date
			{
				//then build the first loop request to dhis2 API
				_pageCount=1;
				_pageSize=parseInt(config.batchSizeFacilityToSync);
				_currentPage=1;
				requestOrgUnits=`/organisationUnits.json?order=level:asc&pageSize=${_pageSize}&page=${_currentPage}&fields=href,id,code,level,parent,displayName`;
			}
			else
			{
				_pageSize=config.batchSizeFacilityToSync;
				_currentPage=syncRecord.current;
				_pageCount=syncRecord.pageCount;
				requestOrgUnits=`/organisationUnits.json?order=level:asc&pageSize=${_pageSize}&page=${_currentPage}&fields=href,id,code,level,parent,displayName`;
				//if(syncRecord.current > syncRecord.pageCount)
				
			}
			if(_currentPage<=_pageCount)
			//if(_currentPage< 8)
			{
				winston.info("Processing the page : "+_currentPage);
				var orchestrations=[];
				orchestrations = [{ 
					ctxObjectRef: "OrgUnits",
					name: "page_"+_currentPage, 
					domain: config.dhis2Server.url,
					path: config.dhis2Server.orgunitapipath+requestOrgUnits,
					params: "",
					body: "",
					method: "GET",
					headers: {'Authorization': basicClientToken}
				  }];
				var ctxObject = []; 
				var orchestrationsResults=[]; 
				async.each(orchestrations, function(orchestration, callback) {
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
						ctxObject[orchestration.ctxObjectRef] = resp.body.organisationUnits;
						callback();
					});//end of needle orchUrl
				},function(err)
				{
					if(err)
					{
						winston.error(err);
					}
					var oPager=orchestrationsResults[0].response.body.pager;
					//console.log(oPager);
					var pageCount=oPager.pageCount;
					winston.info("dhis2 Orgunits extracted... ");
					winston.info("OrgUnits extracted :"+ ctxObject.OrgUnits.length);
					var organizationBundle=customLibrairy.buildOrganizationHierarchy( ctxObject.OrgUnits);
					winston.info("Transform orgunit list to FHIR Bundle. Total entry :"+organizationBundle.entry.length);
					var listOrganizationLevel1=customLibrairy.getOrganizationByLevel("level_1",organizationBundle.entry);
					winston.info("Process Organization level 1. Nbr of entities :"+listOrganizationLevel1.length);
					var orchestrations2Fhir=[];
					for(var i=0;i<listOrganizationLevel1.length;i++)
					{
						var oOrganization=listOrganizationLevel1[i];
						orchestrations2Fhir.push({ 
						ctxObjectRef: "organisation_"+i,
						name: "push orgnization for fhir ", 
						domain: config.hapiServer.url,
						path: "/fhir/Organization/"+oOrganization.id,
						params: "",
						body:  JSON.stringify(oOrganization),
						method: "PUT",
						headers: {'Content-Type': 'application/json'}
						});
					}
					var orchestrations2Fhir=[];
					var async2Fhir = require('async');
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
						
						
					},function(err)
					{
						if(err)
						{
							winston.error(err);
						}
						
						var listOrganizationLevel2=customLibrairy.getOrganizationByLevel("level_2",organizationBundle.entry);
						winston.info("Process Organization level 2. Nbr of entities :"+listOrganizationLevel2.length);
						var orchestrations2FhirLevel2=[];
						
			
						for(var i=0;i<listOrganizationLevel2.length;i++)
						{
							var oOrganization=listOrganizationLevel2[i];
							orchestrations2FhirLevel2.push({ 
							ctxObjectRef: "organisation_"+i,
							name: "push orgnization for fhir ", 
							domain: config.hapiServer.url,
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
							
						}, function(err)
						{
							if(err)
							{
								winston.err(err);
							}
							var listOrganizationLevel3=customLibrairy.getOrganizationByLevel("level_3",organizationBundle.entry);
							winston.info("Process Organization level 3. Nbr of entities :"+listOrganizationLevel3.length);
							var orchestrations2FhirLevel3=[];
							for(var i=0;i<listOrganizationLevel3.length;i++)
							{
								var oOrganization=listOrganizationLevel3[i];
								orchestrations2FhirLevel3.push({ 
								ctxObjectRef: "organisation_"+i,
								name: "push orgnization for fhir ", 
								domain: config.hapiServer.url,
								path: "/fhir/Organization/"+oOrganization.id,
								params: "",
								body:  JSON.stringify(oOrganization),
								method: "PUT",
								headers: {'Content-Type': 'application/json'}
								});
							}
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
								
							
						},function(err)
						{
							if(err)
							{
								winston.error(err);
							}
							var listOrganizationLevel4=customLibrairy.getOrganizationByLevel("level_4",organizationBundle.entry);
							winston.info("Process Organization level 4. Nbr of entities :"+listOrganizationLevel4.length);
							var orchestrations2FhirLevel4=[];
							for(var i=0;i<listOrganizationLevel4.length;i++)
							{
								var oOrganization=listOrganizationLevel4[i];
								orchestrations2FhirLevel4.push({ 
								ctxObjectRef: "organisation_"+i,
								name: "push orgnization for fhir ", 
								domain: config.hapiServer.url,
								path: "/fhir/Organization/"+oOrganization.id,
								params: "",
								body:  JSON.stringify(oOrganization),
								method: "PUT",
								headers: {'Content-Type': 'application/json'}
								});
							}
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
								
							
							},function(err)
							{
								if(err)
								{
									winston.error(err);
								}
								var listOrganizationLevel5=customLibrairy.getOrganizationByLevel("level_5",organizationBundle.entry);
								console.log("Process Organization level 5. Nbr of entities :"+listOrganizationLevel5.length);
								//if(listOrganizationLevel5.length>0){
									var orchestrations2FhirLevel5=[];
									for(var i=0;i<listOrganizationLevel5.length;i++)
									{
										var oOrganization=listOrganizationLevel5[i];
										orchestrations2FhirLevel5.push({ 
										ctxObjectRef: "organisation_"+i,
										name: "push orgnization for fhir ", 
										domain: config.hapiServer.url,
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
										
								
									},function(err)
									{
										if(err)
										{
											winston.error(err);
										}
										var urn = mediatorConfig.urn;
										var status = 'Successful';
										var response = {
										  status: 200,
										  headers: {
											'content-type': 'application/json'
										  },
										  body:JSON.stringify( {'resquestResultToFhirLevel':'success'}),
										  timestamp: new Date().getTime()
										};
										var orchestrationToReturn=[
											{
												name: "FacilitySync",
												request: {
												  path :"/fhir/Organization/",
												  headers: {'Content-Type': 'application/json'},
												  querystring: "",
												  body:JSON.stringify( {'Process sync':'succeded'}),
												  method: "PUT",
												  timestamp: new Date().getTime()
												},
												response: {
												  status: 200,
												  body:JSON.stringify({'Process sync':'succeded'}),
												  timestamp: new Date().getTime()
												}
											}
											];
										var properties = {};
										properties['Nombre organization maj'] =organizationBundle.entry.length;
										var returnObject = {
										  "x-mediator-urn": urn,
										  "status": status,
										  "response": response,
										  //"orchestrations": orchestrationToReturn,
										  "orchestrations": orchestrationToReturn,
										  "properties": properties
										}
										console.log("********************Fin de la synchronisation DHIS2=>FHIR***********************************");
										customLibrairy.upDateLogSyncFacility(new Date(_dateOperation),pageCount,function(res)
										{
											if(res)
											{
												winston.info("Log sync orgunit => fhir done");
											}
											else
											{
												winston.error("Log sync orgunit => fhir failed");
											}
										});
										res.set('Content-Type', 'application/json+openhim');
										res.send(returnObject);
									});//end async2FhirLevel5
									
							});
					
						});
							
						});
						
				
					});
					
				})//end async.each orcherstration
				
			}
			else
			{
				winston.info("All page to sync orgunits=>fhir has been processed!");
				var urn = mediatorConfig.urn;
				var status = 'Successful';
				var response = {
				  status: 200,
				  headers: {
					'content-type': 'application/json'
				  },
				  body:"",
				  timestamp: new Date().getTime()
				};
				var orchestrationToReturn=[
				{
					name: "FacilitySync",
					request: {
					  path :"/fhir/Organization/",
					  headers: {'Content-Type': 'application/json'},
					  querystring: "",
					  body:JSON.stringify( {'Process':'All page to sync orgunits=>fhir has been processed'}),
					  method: "PUT",
					  timestamp: new Date().getTime()
					},
					response: {
					  status: 200,
					  body:JSON.stringify({'Process':'All page to sync orgunits=>fhir has been processed'}),
					  timestamp: new Date().getTime()
					}
				}
				];
				var properties = {};
				var returnObject = {
				  "x-mediator-urn": urn,
				  "status": status,
				  "response": response,
				  "orchestrations":orchestrationToReturn ,
				  "properties": properties
				}
				res.set('Content-Type', 'application/json');
				res.send(returnObject);
			}
			
			
		});//ebnd of customLibrairy.getSyncLogFacility
		
	})//end of app.get /syncorgunit2fhir
	app.get('/mapfacility2fhir', (req, res) => {
		needle.defaults(
		{
			open_timeout: 600000
		});
		winston.info("Start eSIGL=>Organization mapping...!");
		//console.log(req.params);
		//return;
		const basicClientToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
		var _currentDateOperation=new Date();
		var _dateOperation=_currentDateOperation.toJSON().split("T")[0];
		customLibrairy.getSyncLogFacilityeSigl(_dateOperation,function(syncRecord)
		{
			var _pageSize=0;
			var _currentPage=0;
			var _pageCount=0;
			var requestFacilities="";
			console.log(syncRecord);
			if(syncRecord==null)//sync on going on the specified date
			{
				//then build the first loop request to esigl API
				_pageSize=parseInt(config.batchSizeeSGLFacilityToSync);
				_currentPage=1;
				requestFacilities=`/lookup/facilities?paging=false&pageSize=${_pageSize}&page=${_currentPage}`;
			}
			else
			{
				_pageSize=config.batchSizeeSGLFacilityToSync;
				_currentPage=syncRecord.current;
				requestFacilities=`/lookup/facilities?paging=false&pageSize=${_pageSize}&page=${_currentPage}`;
				//if(syncRecord.current > syncRecord.pageCount)
				
			}
			winston.info("Looping step page "+_currentPage);
			var orchestrations=[];
			orchestrations = [{ 
				ctxObjectRef: "facilities",
				name: "Get facilities from eSIGL", 
				domain: config.esiglServer.url,
				path: config.esiglServer.resourcespath+requestFacilities,
				params: "",
				body: "",
				method: "GET",
				headers: {'Authorization': basicClientToken}
			  },
			  {
			  ctxObjectRef: "facilityTypes",
				name: "Get facility types from eSIGL", 
				domain: config.esiglServer.url,
				path: config.esiglServer.resourcespath+"/lookup/facility-types",
				params: "",
				body: "",
				method: "GET",
				headers: {'Authorization': basicClientToken}
			  }
			  ];
			var ctxObject = []; 
			var orchestrationsResults=[]; 
			var listFacilitiesFromeSIGL=[];
			var listFacilityTypes=[];
			async.each(orchestrations, function(orchestration, callback) {
			var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
			//console.log(orchUrl);
			var options={headers:orchestration.headers};
			winston.info("Querying "+orchestration.ctxObjectRef+"from eSIGL....");
			needle.get(orchUrl,options, function(err, resp) {
				if ( err ){
					callback(err);
				}
				orchestrationsResults.push({
				name: orchestration.name,
				request: {
				  path : orchestration.path,
				  headers: orchestration.headers,
				  querystring: orchestration.params,
				  body: orchestration.body,
				  method: orchestration.method,
				  timestamp: new Date().getTime()
				},
				response: {
				  status: resp.statusCode,
				  body: JSON.stringify(resp.body, null, 4),
				  timestamp: new Date().getTime()
				}
				});
				ctxObject[orchestration.ctxObjectRef] = resp.body;
				callback();
			});//end of needle
			
		},function(err)
		{
			if(err)
			{
				winston.error(err);
			}
			winston.info("Facilities extracted from eSIGL... ");
			//console.log(ctxObject.facilities);
			listFacilitiesFromeSIGL=ctxObject.facilities.facilities;
			listFacilityTypes=ctxObject.facilityTypes["facility-types"];//uses [] to access json attributes with '-'
			winston.info("Facilities extracted :"+listFacilitiesFromeSIGL.length);
			winston.info("Facility-types extracted :"+listFacilityTypes.length);
			var mappingObject=[];
			//if the last page has been reached, send to openhim a resultorchestrations response
			if(listFacilitiesFromeSIGL.length>0)
			{
				var listIdFacilityFromeSIGL=[];
				for(var iteratorFac=0;iteratorFac<listFacilitiesFromeSIGL.length;iteratorFac++)
				{
					listIdFacilityFromeSIGL.push(""+listFacilitiesFromeSIGL[iteratorFac].id);
				}
				listIdFacilityFromeSIGL.sort();
				//console.log(listIdFacilityFromeSIGL);
				customLibrairy.readCSVFile(config.mappingFile,function(dataFile)
				{
					if(dataFile.length>0)
					{
						customLibrairy.getAllMappingSync(function(listMappingSync)
						{
							var eSigleIdAlreadySynched=[];
							if(listMappingSync!=null)
							{
								for(var iteratorSynchedFacility=0;iteratorSynchedFacility<listMappingSync.length;iteratorSynchedFacility++)
								{
									eSigleIdAlreadySynched.push(listMappingSync[iteratorSynchedFacility].facilityId);
								}
								eSigleIdAlreadySynched.sort();
							}
							winston.info("Lines read in CSV file :"+dataFile.length);
							var orchestrations2GetOrganization=[];
							var listeSIGLId2Synch=[];
							for(var iteratorLine =0;iteratorLine<dataFile.length;iteratorLine++)
							{
								if(dataFile[iteratorLine][0]!="" && dataFile[iteratorLine][1]!="")
								{
									//check if the facilityid has been already processed
									var ideSIGLToProcess=dataFile[iteratorLine][0].trim().replace(/\s/g,"");
									
									if(eSigleIdAlreadySynched.includes(ideSIGLToProcess))
									{
										console.log("Facility already mapped:"+ideSIGLToProcess);
										continue;
									}
									//check also if the facilityid is among the listtoprocess
									//console.log("id:"+ideSIGLToProcess);
									if(!listIdFacilityFromeSIGL.includes(ideSIGLToProcess))
									{
										//winston.warn("Not among the list of facilityToProcess: "+ideSIGLToProcess);
										continue;
									}
									else
									{
										winston.warn("Among the list of facilityToProcess: "+ideSIGLToProcess);
									}
									mappingObject.push(
									{
										idSigl:dataFile[iteratorLine][0],
										idOrganization:dataFile[iteratorLine][1]
									});
									listeSIGLId2Synch.push(dataFile[iteratorLine][0].trim().replace(/\s/g,""));
									//console.log("listeSIGLId2Synch");
									//console.log(listeSIGLId2Synch);
									orchestrations2GetOrganization.push(
										{ 
										//ctxObjectRef: "organization_"+iteratorLine,
										ctxObjectRef: dataFile[iteratorLine][0].trim().replace(/\s/g,""),
										name: "get organization from hapi", 
										domain: config.hapiServer.url,
										path: "/fhir/Organization/"+dataFile[iteratorLine][1].trim().replace(/\s/g,""),
										params: "",
										body: "",
										method: "GET",
										headers: {'Content-Type': 'application/json'}
									  });
								}//end if idSigl
								
							}//end for iteratorLine
							winston.info("Facility retains for processing :"+orchestrations2GetOrganization.length);
							var ctxObjectOrgFhir = []; 
							var orchestrationsResultsOrgFhir=[]; 
							var counter=1;
							var asyncFhir = require('async');
							var listResolvedOrganization=[];
							asyncFhir.each(orchestrations2GetOrganization, function(orchestration2GetOrganisation, callbackGetFhir) {
							var orchUrl = orchestration2GetOrganisation.domain + orchestration2GetOrganisation.path + orchestration2GetOrganisation.params;
							/*
							needle.get(orchUrl, function(err, resp) {
								if(err)
								{
									winston.error(err);
									callbackGetFhir(err);
								}
								console.log(counter+"/"+orchestrations2GetOrganization.length);
								console.log("...Getting  "+orchestration2GetOrganisation.path);
								orchestrationsResultsOrgFhir.push({
									name: orchestration2GetOrganisation.name,
									request: {
									  path : orchestration2GetOrganisation.path,
									  headers: orchestration2GetOrganisation.headers,
									  querystring: orchestration2GetOrganisation.params,
									  body: orchestration2GetOrganisation.body,
									  method: orchestration2GetOrganisation.method,
									  timestamp: new Date().getTime()
									},
									response: {
									  status: resp.statusCode,
									  body: JSON.stringify(resp.body, null, 4),
									  timestamp: new Date().getTime()
									}
									});
								ctxObjectOrgFhir.push( {eSIGLid:orchestration2GetOrganisation.ctxObjectRef,resource:JSON.parse(resp.body.toString('utf8'))});
								//ctxObjectOrgFhir.push( resp.body);
								counter++;
								callbackGetFhir();
							});//end of needle
							*/
							var args = "-X GET  -H 'Content-Type: application/fhir+json' '"+orchUrl+"'";
							var exec = require('child_process').exec;
							exec('curl ' + args, function (error, stdout, stderr) {
							  //console.log('stdout: ' + stdout);
							  //console.log('stderr: ' + stderr);
							  if (error !== null) {
								winston.error('exec error: ' + error);
								callbackGetFhir(error);
							  }
							  console.log(counter+"/"+orchestrations2GetOrganization.length);
								console.log("...Getting  "+orchestration2GetOrganisation.path);
								orchestrationsResultsOrgFhir.push({
									name: orchestration2GetOrganisation.name,
									request: {
									  path : orchestration2GetOrganisation.path,
									  headers: orchestration2GetOrganisation.headers,
									  querystring: orchestration2GetOrganisation.params,
									  body: orchestration2GetOrganisation.body,
									  method: orchestration2GetOrganisation.method,
									  timestamp: new Date().getTime()
									},
									response: {
									  status: 200,
									  //body: JSON.stringify(stdout, null, 4),
									  body: JSON.stringify(stdout),
									  timestamp: new Date().getTime()
									}
								});
							
							//ctxObjectOrgFhir.push( {eSIGLid:orchestration2GetOrganisation.ctxObjectRef,resource:JSON.parse(stdout.toString('utf8'))});
							ctxObjectOrgFhir.push( {eSIGLid:orchestration2GetOrganisation.ctxObjectRef,resource:JSON.parse(stdout)});
							
							counter++;
							callbackGetFhir();
						  });//end of exec
							
						},function(err)
						{
							if (err){
							winston.error(err);
							}
							winston.info("Organization resolved from ids");
							winston.info("Organization resolved :"+ctxObjectOrgFhir.length)
							var listUpdatedOrganization=[];
							//console.log(listFacilitiesFromeSIGL);
							for(var iteratorOrg=0;iteratorOrg<ctxObjectOrgFhir.length;iteratorOrg++)
							{
								//console.log("ressource type :"+ctxObjectOrgFhir[iteratorOrg].resource.resourceType);
								if(ctxObjectOrgFhir[iteratorOrg].resource.resourceType=="Organization")
								{
									var eSIGLFacility=customLibrairy.getFacilityInTheListFromId(ctxObjectOrgFhir[iteratorOrg].eSIGLid,listFacilitiesFromeSIGL);
									//now get the facility-type of the related eSIGL facility from the list
									if(eSIGLFacility!=null)
									{
										var eSIGLType=customLibrairy.getFacilityTypeInTheListFromId(eSIGLFacility.typeId,listFacilityTypes);
										if(eSIGLType!=null)
										{
											//Now update the organization
											var newOrganization=customLibrairy.updateOrganizationFromeSIGL(eSIGLFacility,eSIGLType,ctxObjectOrgFhir[iteratorOrg].resource,config.esiglServer.url);
											if(newOrganization!=null)
											{
												listUpdatedOrganization.push(newOrganization);
											}
											else
											{
												winston.error("Failed to update organization with eSIGL Facility");
											}
											
										}
										else
										{
											winston.error("eSIGL facility-type not found for the id: "+ eSIGLFacility.typeId);
											continue;
										}
									}
									else
									{
										winston.error("eSIGL Facility not found for the id: "+ ctxObjectOrgFhir[iteratorOrg].eSIGLid);
										continue;
									}
								}
								
							}//end for iteratorOrg
							
							winston.info("updated Organization :"+listUpdatedOrganization.length);
							
							if(listUpdatedOrganization.length>0){
								winston.info("Organization convertion done ");
								winston.info("Building request to push updated Organization to FHIR ");
								var orchestrations2FhirUpdate=[];
								for(var i=0;i<listUpdatedOrganization.length;i++)
								{
									var oOrganization=listUpdatedOrganization[i];
									orchestrations2FhirUpdate.push({ 
									ctxObjectRef: "organisation_"+i,
									name: "push orgnization for fhir ", 
									domain: config.hapiServer.url,
									path: "/fhir/Organization/"+oOrganization.id,
									params: "",
									body:  JSON.stringify(oOrganization),
									method: "PUT",
									headers: {'Content-Type': 'application/json'}
									});
								}
								var asyncFhir2Update = require('async');
								var ctxObject2Update = []; 
								var orchestrationsResults2Update=[];
								counter=1;
								asyncFhir2Update.each(orchestrations2FhirUpdate, function(orchestration2FhirUpdate, callbackFhirUpdate) {
									var orchUrl = orchestration2FhirUpdate.domain + orchestration2FhirUpdate.path + orchestration2FhirUpdate.params;
									var options={headers:orchestration2FhirUpdate.headers};
									var organizationToPush=orchestration2FhirUpdate.body;
									needle.put(orchUrl,organizationToPush,{json:true}, function(err, resp) {
										// if error occured
										if ( err ){
											winston.error("Needle: error when pushing data to hapi");
											callbackFhirUpdate(err);
										}
										winston.info(counter+"/"+orchestrations2FhirUpdate.length);
										winston.info("...Inserting "+orchestration2FhirUpdate.path);
										orchestrationsResults2Update.push({
										name: orchestration2FhirUpdate.name,
										request: {
										  path : orchestration2FhirUpdate.path,
										  headers: orchestration2FhirUpdate.headers,
										  querystring: orchestration2FhirUpdate.params,
										  body: orchestration2FhirUpdate.body,
										  method: orchestration2FhirUpdate.method,
										  timestamp: new Date().getTime()
										},
										response: {
										  status: resp.statusCode,
										  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
										  timestamp: new Date().getTime()
										}
										});
										// add orchestration response to context object and return callback
										ctxObject2Update[orchestration2FhirUpdate.ctxObjectRef] = resp.body.toString('utf8');
										counter++;
										callbackFhirUpdate();
									});//end of needle.put
								},function(err)
								{
									if (err){
										winston.error(err);
									}
									winston.info("********************End of dhis2=>esigl facility mapping process***********************************");
									var urn = mediatorConfig.urn;
									var status = 'Successful';
									var response = {
									  status: 200,
									  headers: {
										'content-type': 'application/json'
									  },
									  body:JSON.stringify( {'Mapping operation':'success'}),
									  timestamp: new Date().getTime()
									};
									var properties = {};
									properties['Nombre organization maj'] =ctxObject2Update.length;
									var returnObject = {
									  "x-mediator-urn": urn,
									  "status": status,
									  "response": response,
									  "orchestrations": orchestrationsResults2Update,
									  "properties": properties
									}
									
									
									customLibrairy.saveAllSynchedMapping(new Date(),listeSIGLId2Synch,function(resMappingSync)
									{
										customLibrairy.upDateLogSyncFacilityeSigl(new Date(_dateOperation),_pageCount,function(res)
										{
											if(res)
											{
												winston.info("Log sync orgunit => fhir done");
											}
											else
											{
												winston.error("Log sync orgunit => fhir failed");
											}
										});//end customLibrairy.upDateLogSyncFacilityeSigl
										
									});//end ustomLibrairy.saveAllSynchedMapping
									res.set('Content-Type', 'application/json');
									res.send(returnObject);
									
									
								});//end asyncFhir2Update orchestrations2FhirUpdate
								
							}//end if listUpdatedOrganization.length>0
							else
							{
								var urn = mediatorConfig.urn;
								var status = 'Successful';
								var response = {
								  status: 200,
								  headers: {
									'content-type': 'application/json'
								  },
								  body:JSON.stringify( {'Process':'Facilities to sync does not exist in hapi'}),
								  timestamp: new Date().getTime()
								};
								var orchestrationToReturn=[
								{
									name: "FacilitySync",
									request: {
									  path :"/lookup/Facilities",
									  headers: {'Content-Type': 'application/json'},
									  querystring: "",
									  body:JSON.stringify( {'Process':'Facilities to sync does not exist in hapi'}),
									  method: "PUT",
									  timestamp: new Date().getTime()
									},
									response: {
									  status: 200,
									  body:JSON.stringify({'Process':'Facilities to sync does not exist in hapi'}),
									  timestamp: new Date().getTime()
									}
								}
								];
								var properties = {};
								properties['resultats'] = "Facilities to sync does not exist in hapi";
								var returnObject = {
								  "x-mediator-urn": urn,
								  "status": status,
								  "response": response,
								  "orchestrations": orchestrationToReturn,
								  "properties": properties
								}
								res.set('Content-Type', 'application/json+openhim');
								res.send(returnObject);
							}
						})//end asyncFhir.each(orchestrations2GetOrganization
							
						});//end customLibrairy.getAllMappingSync
						//do the mapping and then increment the facilitySyncLog
						
					}//end if dataFile.length>0
					
				})//end customLibrairy.readCSVFile
			}
			else//end back response to mediator
			{
				var urn = mediatorConfig.urn;
				var status = 'Successful';
				var response = {
				  status: 200,
				  headers: {
					'content-type': 'application/json'
				  },
				  body:JSON.stringify( {'Process':'No facilities to sync in the loop'}),
				  timestamp: new Date().getTime()
				};
				var orchestrationToReturn=[
				{
					name: "FacilitySync",
					request: {
					  path :"/lookup/Facilities",
					  headers: {'Content-Type': 'application/json'},
					  querystring: "",
					  body:JSON.stringify( {'Process':'No facilities to sync in the loop'}),
					  method: "PUT",
					  timestamp: new Date().getTime()
					},
					response: {
					  status: 200,
					  body:JSON.stringify({'Process':'No facilities to sync in the loop'}),
					  timestamp: new Date().getTime()
					}
				}
				];
				var properties = {};
				properties['resultats'] = "No facilities to sync in the loop";
				var returnObject = {
				  "x-mediator-urn": urn,
				  "status": status,
				  "response": response,
				  "orchestrations": orchestrationToReturn,
				  "properties": properties
				}
				res.set('Content-Type', 'application/json+openhim');
				res.send(returnObject);
			}
			
		});//end of async. orchestration getFacilities
			
		});//end customLibrairy.getSyncLogFacility
		
	});// end of app.get /mapfacility2fhir
	
	app.get('/syncproduct2fhir', (req, res) => {
		needle.defaults(
		{
			open_timeout: 600000
		});
		winston.info("Start extraction of products from eSIGL...!");
		const basicClientToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
		var orchestrations=[];
		orchestrations = [{ 
			ctxObjectRef: "products",
			name: "Get products from eSIGL", 
			domain: config.esiglServer.url,
			path: config.esiglServer.resourcespath+"/lookup/products?paging=false",
			params: "",
			body: "",
			method: "GET",
			headers: {'Authorization': basicClientToken}
		  },
		  {
		  ctxObjectRef: "productCategories",
			name: "Get product categories from eSIGL", 
			domain: config.esiglServer.url,
			path: config.esiglServer.resourcespath+"/lookup/product-categories",
			params: "",
			body: "",
			method: "GET",
			headers: {'Authorization': basicClientToken}
		  },
		  {
		  ctxObjectRef: "dosageUnits",
			name: "Get dosage unit from eSIGL", 
			domain: config.esiglServer.url,
			path: config.esiglServer.resourcespath+"/lookup/dosage-units",
			params: "",
			body: "",
			method: "GET",
			headers: {'Authorization': basicClientToken}
		  }
		  ];
		var ctxObject = []; 
		var orchestrationsResults=[]; 
		var listProductsFromeSIGL=[];
		var listProductCategoryFromeSIGL=[];
		var listDosageUnitFromeSIGL=[];
		async.each(orchestrations, function(orchestration, callback) {
			var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
			//console.log(orchUrl);
			var options={headers:orchestration.headers};
			winston.info("Querying "+orchestration.ctxObjectRef+"from eSIGL....");
			needle.get(orchUrl,options, function(err, resp) {
				if ( err ){
					callback(err);
				}
				orchestrationsResults.push({
				name: orchestration.name,
				request: {
				  path : orchestration.path,
				  headers: orchestration.headers,
				  querystring: orchestration.params,
				  body: orchestration.body,
				  method: orchestration.method,
				  timestamp: new Date().getTime()
				},
				response: {
				  status: resp.statusCode,
				  body: JSON.stringify(resp.body, null, 4),
				  timestamp: new Date().getTime()
				}
				});
				ctxObject[orchestration.ctxObjectRef] = resp.body;
				callback();
			});//end of needle
			
		},function(err){
			if (err){
				winston.error(err);
			}
			winston.info("Products extracted from eSIGL... ");
			winston.info("Product-Categories extracted from eSIGL... ");
			winston.info("Dosage-units extracted from eSIGL... ");
			var urn = mediatorConfig.urn;
			var status = 'Successful';
			var response = {
			  status: 200,
			  headers: {
				'content-type': 'application/json'
			  },
			  body:JSON.stringify( {'resquestResult':'success'}),
			  timestamp: new Date().getTime()
			};
			listProductsFromeSIGL=ctxObject.products.products;
			listProductCategoryFromeSIGL=ctxObject.productCategories["product-categories"];
			listDosageUnitFromeSIGL=ctxObject.dosageUnits["dosage-units"]
			////loop throup product to constr
			var listProductsFhir=customLibrairy.buildProductFhirResources(listProductsFromeSIGL,listProductCategoryFromeSIGL,listDosageUnitFromeSIGL,config.esiglServer.url,config.hapiServer.url);
			winston.info("Transformation of product to Fhir product extension done!");
			var orchestrations2FhirUpdate=[];
			for(var i=0;i<listProductsFhir.length;i++)
			{
				var oProduct=listProductsFhir[i];
				orchestrations2FhirUpdate.push({ 
				ctxObjectRef: "product_"+i,
				name: "push product for fhir ", 
				domain: config.hapiServer.url,
				path: "/fhir/Basic/"+oProduct.id,
				params: "",
				body:  JSON.stringify(oProduct),
				method: "PUT",
				headers: {'Content-Type': 'application/json'}
				});
			}
			var asyncFhir2Update = require('async');
			var ctxObject2Update = []; 
			var orchestrationsResults2Update=[];
			var counter=1;
			asyncFhir2Update.each(orchestrations2FhirUpdate, function(orchestration2FhirUpdate, callbackFhirUpdate) {
				var orchUrl = orchestration2FhirUpdate.domain + orchestration2FhirUpdate.path + orchestration2FhirUpdate.params;
				var options={headers:orchestration2FhirUpdate.headers};
				var productToPush=orchestration2FhirUpdate.body;
				needle.put(orchUrl,productToPush,{json:true}, function(err, resp) {
					// if error occured
					if ( err ){
						winston.error("Needle: error when pushing product data to hapi");
						callbackFhirUpdate(err);
					}
					winston.info(counter+"/"+orchestrations2FhirUpdate.length);
					winston.info("...Inserting "+orchestration2FhirUpdate.path);
					orchestrationsResults2Update.push({
					name: orchestration2FhirUpdate.name,
					request: {
					  path : orchestration2FhirUpdate.path,
					  headers: orchestration2FhirUpdate.headers,
					  querystring: orchestration2FhirUpdate.params,
					  body: orchestration2FhirUpdate.body,
					  method: orchestration2FhirUpdate.method,
					  timestamp: new Date().getTime()
					},
					response: {
					  status: resp.statusCode,
					  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
					  timestamp: new Date().getTime()
					}
					});
					// add orchestration response to context object and return callback
					ctxObject2Update[orchestration2FhirUpdate.ctxObjectRef] = resp.body.toString('utf8');
					counter++;
					callbackFhirUpdate();
				});//end of needle.put
			},function(err){
				if (err){
					winston.error(err);
				}
				var urn = mediatorConfig.urn;
				var status = 'Successful';
				var response = {
				  status: 200,
				  headers: {
					'content-type': 'application/json'
				  },
				  body:JSON.stringify( {'Product_sync_operationd':'success'}),
				  timestamp: new Date().getTime()
				};
				var properties = {};
				properties['Nombre produits maj'] =ctxObject2Update.length;
				var returnObject = {
				  "x-mediator-urn": urn,
				  "status": status,
				  "response": response,
				  "orchestrations": orchestrationsResults2Update,
				  "properties": properties
				}
				winston.info("End of eSIGL=>Fhir products orchestration");
				res.set('Content-Type', 'application/json+openhim');
				res.send(returnObject);
			})//end of asyncFhir2Update
			
			//
		})//end of async.orchestrations
		
	})//end of app.get syncproduct2fhir
	app.get('/syncprogram2fhir', (req, res) => {
		needle.defaults(
		{
			open_timeout: 600000
		});
		winston.info("Start extraction of programs from eSIGL...!");
		const basicClientToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
		var orchestrations=[];
		orchestrations = [{ 
			ctxObjectRef: "programs",
			name: "Get programs from eSIGL", 
			domain: config.esiglServer.url,
			path: config.esiglServer.resourcespath+"/lookup/programs",
			params: "",
			body: "",
			method: "GET",
			headers: {'Authorization': basicClientToken}
		  },
		  {
			ctxObjectRef: "productCategories",
			name: "productCategory", 
			domain: config.esiglServer.url,
			path:config.esiglServer.resourcespath+"/lookup/product-categories",
			params: "",
			body: "",
			method: "GET",
			headers: {'Authorization': basicClientToken}
			}
		  ];
		var ctxObject=[]; 
		var orchestrationsResults=[]; 
		var listProgramsFromeSIGL=[];
		var listProductCategories=[];
		async.each(orchestrations, function(orchestration, callback) {
			var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
			//console.log(orchUrl);
			var options={headers:orchestration.headers};
			
			winston.info("Querying "+orchestration.ctxObjectRef+"from eSIGL....");
			needle.get(orchUrl,options, function(err, resp) {
				if ( err ){
					callback(err);
				}
				orchestrationsResults.push({
				name: orchestration.name,
				request: {
				  path : orchestration.path,
				  headers: orchestration.headers,
				  querystring: orchestration.params,
				  body: orchestration.body,
				  method: orchestration.method,
				  timestamp: new Date().getTime()
				},
				response: {
				  status: resp.statusCode,
				  body: JSON.stringify(resp.body, null, 4),
				  timestamp: new Date().getTime()
				}
				});
				ctxObject[orchestration.ctxObjectRef] = resp.body;
				//console.log(ctxObject);
				callback();
			});//end of needle
			
		},function(err){
			if (err){
				winston.error(err);
			}
			winston.info("Programs and product categories extracted from eSIGL... ");
			var urn = mediatorConfig.urn;
			var status = 'Successful';
			var response = {
			  status: 200,
			  headers: {
				'content-type': 'application/json'
			  },
			  body:JSON.stringify( {'resquestResult':'success'}),
			  timestamp: new Date().getTime()
			};
			//console.log(ctx);
			listProgramsFromeSIGL=ctxObject.programs.programs;
			listProductCategories=ctxObject.productCategories['product-categories']
			//console.log(listProgramsFromeSIGL);
			//return;
			//var listProgramsFhir=customLibrairy.buildProgramFhirResources(listProgramsFromeSIGL,mediatorConfig.config.esiglServer.url,mediatorConfig.config.hapiServer.url);
			
			//foreacdh program get now the category code and the list of supported products
			
			winston.info("Start extraction of programs-products information from eSIGL...!");
			var orchestrationProgramProducts=[];
			for(var iteratorProgram=0;iteratorProgram<listProgramsFromeSIGL.length;iteratorProgram++)
			{
				var oProgramCode=listProgramsFromeSIGL[iteratorProgram].code;
				orchestrationProgramProducts.push(
				{ 
					ctxObjectRef: oProgramCode,
					name: oProgramCode, 
					domain: config.esiglServer.url,
					path: config.esiglServer.resourcespath+"/program-products",
					params: "?programCode="+oProgramCode,
					body: "",
					method: "GET",
					headers: {'Authorization': basicClientToken}
				}
				);
				
			}
			var ctxObjectProgramProduct = []; 
			var orchestrationsResultsProgramProducts=[]; 
			var listProgramProductsFromeSIGL=[];
			var counter=1;
			async.each(orchestrationProgramProducts, function(orchestration, callbackProgramProduct) {
				var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
				var options={headers:orchestration.headers};
				winston.info(counter+"/"+orchestrationProgramProducts.length);
				winston.info("Querying program-products/"+orchestration.ctxObjectRef+"from eSIGL....");
				needle.get(orchUrl,options, function(err, resp) {
					if ( err ){
						callbackProgramProduct(err);
					}
					orchestrationsResultsProgramProducts.push({
					name: orchestration.name,
					request: {
					  path : orchestration.path,
					  headers: orchestration.headers,
					  querystring: orchestration.params,
					  body: orchestration.body,
					  method: orchestration.method,
					  timestamp: new Date().getTime()
					},
					response: {
					  status: resp.statusCode,
					  //body: JSON.stringify(resp.body, null, 4),
					  body: resp.body,
					  timestamp: new Date().getTime()
					}
					});
					ctxObjectProgramProduct[orchestration.ctxObjectRef] = resp.body;
					//counter++;
					callbackProgramProduct();
				});//end needle get
				counter++;
			},function(error)
			{
				if(err)
				{
					winston.error("err");
				}
				var listAssociatedProgramFhirResources=[];
				for (var iteratorResultProgramProduct=0;iteratorResultProgramProduct<orchestrationsResultsProgramProducts.length;iteratorResultProgramProduct++)
				{
					var programCode=orchestrationsResultsProgramProducts[iteratorResultProgramProduct].response.body.programProductList[0].programCode;
					var oProgramToProcess=customLibrairy.getProgramFromList(programCode,listProgramsFromeSIGL);
					var itemLists=orchestrationsResultsProgramProducts[iteratorResultProgramProduct].response.body.programProductList;
					winston.info(orchestrationsResultsProgramProducts[iteratorResultProgramProduct].response.body.programProductList[0].programCode+" extracted program-products list: "+itemLists.length);
					var itemListProgramProductsByCode=customLibrairy.buildProgramProductsFhirResources(oProgramToProcess,listProductCategories,itemLists,config.esiglServer.url,config.hapiServer.url);
					for(var iteratorProgramResource=0;iteratorProgramResource<itemListProgramProductsByCode.length;iteratorProgramResource++)
					{
						listAssociatedProgramFhirResources.push(itemListProgramProductsByCode[iteratorProgramResource]);
					}
					
				}
				winston.info("Total number of Program-Product Fhir resources extracted :"+listAssociatedProgramFhirResources.length);
				winston.info("**************Transformation of program to Fhir Program extension done!************************");
				//console.log(JSON.stringify(listAssociatedProgramFhirResources[0]));
				//return;
				var orchestrations2FhirUpdate=[];
				for(var i=0;i<listAssociatedProgramFhirResources.length;i++)
				{
					var oProgram=listAssociatedProgramFhirResources[i];
					orchestrations2FhirUpdate.push({ 
					ctxObjectRef: "program_"+i,
					name: "push program for fhir ", 
					domain: config.hapiServer.url,
					path: "/fhir/OrganizationAffiliation/"+oProgram.id,
					params: "",
					body:  JSON.stringify(oProgram),
					method: "PUT",
					headers: {'Content-Type': 'application/json'}
					});
				}
				var asyncFhir2Update = require('async');
				var ctxObject2Update = []; 
				var orchestrationsResults2Update=[];
				var counter=1;
				var asyncFhir2Update = require('async');
				var ctxObject2Update = []; 
				var orchestrationsResults2Update=[];
				var counter=1;
				asyncFhir2Update.each(orchestrations2FhirUpdate, function(orchestration2FhirUpdate, callbackFhirUpdate) {
					var orchUrl = orchestration2FhirUpdate.domain + orchestration2FhirUpdate.path + orchestration2FhirUpdate.params;
					var options={headers:orchestration2FhirUpdate.headers,json:true};
					var productToPush=orchestration2FhirUpdate.body;
					needle.put(orchUrl,productToPush,options, function(err, resp) {
					//needle.put(orchUrl,productToPush,{json:true}, function(err, resp) {
						// if error occured
						if ( err ){
							
							//console.log(productToPush);
							winston.error(err);
							winston.info("url: "+orchUrl);
							callbackFhirUpdate(err);
						}
						winston.info(counter+"/"+orchestrations2FhirUpdate.length);
						winston.info("...Inserting "+orchestration2FhirUpdate.path);
						orchestrationsResults2Update.push({
						name: orchestration2FhirUpdate.name,
						request: {
						  path : orchestration2FhirUpdate.path,
						  headers: orchestration2FhirUpdate.headers,
						  querystring: orchestration2FhirUpdate.params,
						  body: orchestration2FhirUpdate.body,
						  method: orchestration2FhirUpdate.method,
						  timestamp: new Date().getTime()
						},
						response: {
						  status: resp.statusCode,
						  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
						  timestamp: new Date().getTime()
						}
						});
						// add orchestration response to context object and return callback
						ctxObject2Update[orchestration2FhirUpdate.ctxObjectRef] = resp.body.toString('utf8');
						
						callbackFhirUpdate();
						});//end of needle.put
						counter++;
				}, function(err)
				{
					if(err)
					{
						winston.error(err);
					}
					var urn = mediatorConfig.urn;
					var status = 'Successful';
					var response = {
					  status: 200,
					  headers: {
						'content-type': 'application/json'
					  },
					  body:JSON.stringify( {'Program_sync_operationd':'success'}),
					  timestamp: new Date().getTime()
					};
					var properties = {};
					properties['Nombre program maj'] =orchestrationsResults2Update.length;
					var returnObject = {
					  "x-mediator-urn": urn,
					  "status": status,
					  "response": response,
					  "orchestrations": orchestrationsResults2Update,
					  "properties": properties
					}
					winston.info("End of eSIGL=>Fhir programs orchestration");
					res.set('Content-Type', 'application/json+openhim');
					res.send(returnObject);
					});
				
				
			
			});//end async. orchestrationProgramProducts
			
		})//end of async.orchestrations
		
	})//end of app.get syncproduct2fhir
	app.get('/syncrequisition2fhir', (req, res) => {
		winston.info("***********************Channel for getting requisition triggered*******************************");
		needle.defaults(
		{
			open_timeout: 600000
		});
		const basicClientToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
		var globalSharedOrganisation=[];
		winston.info("Start extraction of requisitions from eSIGL...!");
		//Only facility with the set levele and which the boby contains siglcode will be considered
		var levelOrganizationCode=config.facilityLevesForRequisitions;
		var filter="identifier:text=siglcode&_sort=type&_pretty=true&_count=100";
		var operationType=0 //0 to get requisition from API and one to get requisition from dbs
		getAllOrganizations("",filter,globalSharedOrganisation,function(listOrganizations)
		{
			winston.info("Number of orgunit of having siglcode: "+listOrganizations.length);
			//now  get all synchedOrganization from mongodb log db
			customLibrairy.getAllSynchedOrganization(function (listSynchedOrganizations)
			{
				//console.log(listSynchedOrganizations);
				var listOrganizationToSync=[];
				var batchSize=parseInt(config.batchSizeRequisitionFacilities);
				if(listSynchedOrganizations.length>0)
				{
					//console.log("Synched organization "+listSynchedOrganizations.length);
					winston.info("Section of batch on the organization based on the previous sync...");
					listOrganizationToSync=customLibrairy.getOrganizationsNotSynched(batchSize,listSynchedOrganizations,listOrganizations);
				}
				else //first time or no requisition synched, then take the firstbatch
				{
					winston.info("First batch of organization.... ");
					listOrganizationToSync=customLibrairy.getOrganizationsNotSynched(batchSize,listSynchedOrganizations,listOrganizations);
					
				}
				//console.log(listOrganizationToSync);
				//Now build orchestrator to get requisition by facility
				if(operationType==0)
				{
					
					var orchestrations=[];
					for(var i=0;i<listOrganizationToSync.length;i++)
					{
						var organization=listOrganizationToSync[i];
						var eSiglCode=customLibrairy.getFacilityeSiGLCode(organization);
						
						orchestrations.push(
							{ 
							ctxObjectRef: eSiglCode,
							name: organization.id, 
							domain: config.esiglServer.url,
							path: "/rest-api/requisitions",
							params:"?facilityCode="+eSiglCode,
							body: "",
							method: "GET",
							headers: {'Authorization': basicClientToken}
						  });
						
					}
					var ctxObject = []; 
					var orchestrationsResults=[]; 
					var listRequisitionsFromeSIGL=[];
				
					async.each(orchestrations, function(orchestration, callback) {
						var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
						//console.log(orchUrl);
						var options={headers:orchestration.headers};
						winston.info("Querying requisitions/"+orchestration.ctxObjectRef+" from eSIGL....");
						needle.get(orchUrl,options, function(err, resp) {
							if ( err ){
								callback(err);
							}
							orchestrationsResults.push({
							name: orchestration.name,
							ctxObjectRef:orchestration.ctxObjectRef,
							request: {
							  path : orchestration.path,
							  headers: orchestration.headers,
							  querystring: orchestration.params,
							  body: resp.body.requisitions,
							  method: orchestration.method,
							  timestamp: new Date().getTime()
							},
							response: {
							  status: resp.statusCode,
							  body: JSON.stringify(resp.body.requisitions, null, 4),
							  timestamp: new Date().getTime()
							}
							});
							ctxObject[orchestration.ctxObjectRef] = resp.body;
							callback();
						});//end of needle
					
					},function(err)
					{
						if(err)
						{
							winston.error(err);
							
						}
						winston.info("Requisitions extracted from eSIGL...");
						var status = 'Successful';
						var response = {
						  status: 200,
						  headers: {
							'content-type': 'application/json'
						  },
						  body:JSON.stringify( {'resquestResult':'success'}),
						  timestamp: new Date().getTime()
						};
						//listFromeSIGL=ctxObject.products.products;
						var listRequisitions=[]
						//console.log(orchestrationsResults[0]);
						//console.log("-------------------------------------------------------");
						//Now loop through orchestration results to build fhirResources
						for(var iteratorRes=0;iteratorRes<orchestrationsResults.length;iteratorRes++)
						{
							var oResultOrchestration=orchestrationsResults[iteratorRes];
							var responseBody=JSON.parse(oResultOrchestration.response.body);
							console.log("Total found :"+responseBody.length);
							//remove requisition where periodStartDate < definedConfDate
							var listRequisition2Process=customLibrairy.geRequisitionsFromStartDate(config.periodStartDate,responseBody);
							//console.log(oResultOrchestration);
							listRequisitions=customLibrairy.buildRequisitionFhirResources(oResultOrchestration.name,oResultOrchestration.ctxObjectRef,listRequisition2Process,
								config.esiglServer.url,config.hapiServer.url);
							//console.log(listRequisitions[0]);
							console.log("Total retained based on date :"+listRequisitions.length);
							//break;
						}
						//console.log(JSON.stringify(listRequisitions[0]));
						//return;
						//Nom build the request to push transformed requisition to hapi server
						var orchestrationsRequistition2Push=[];
						for(var iteratorReq=0;iteratorReq<listRequisitions.length;iteratorReq++)
						{
							var oRequisition=listRequisitions[iteratorReq];
							
							orchestrationsRequistition2Push.push(
								{ 
								ctxObjectRef: oRequisition.id,
								name: oRequisition.id, 
								domain: config.hapiServer.url,
								path: "/fhir/Basic/"+oRequisition.id,
								params: "",
								body:  JSON.stringify(oRequisition),
								method: "PUT",
								headers: {'Content-Type': 'application/json'}
							  });
							
						}
						var asyncFhir2Update = require('async');
						var ctxObject2Update = []; 
						var orchestrationsResults2Update=[];
						var counter=1;
						asyncFhir2Update.each(orchestrationsRequistition2Push, function(orchestration2FhirUpdate, callbackFhirUpdate) {
							var orchUrl = orchestration2FhirUpdate.domain + orchestration2FhirUpdate.path + orchestration2FhirUpdate.params;
							var options={headers:orchestration2FhirUpdate.headers};
							var requisition2Push=orchestration2FhirUpdate.body;
							needle.put(orchUrl,requisition2Push,{json:true}, function(err, resp) {
								// if error occured
								if ( err ){
									winston.error("Needle: error when pushing program data to hapi");
									callbackFhirUpdate(err);
								}
								winston.info(counter+"/"+orchestrationsRequistition2Push.length);
								winston.info("...Inserting "+orchestration2FhirUpdate.path);
								orchestrationsResults2Update.push({
								name: orchestration2FhirUpdate.name,
								request: {
								  path : orchestration2FhirUpdate.path,
								  headers: orchestration2FhirUpdate.headers,
								  querystring: orchestration2FhirUpdate.params,
								  body: orchestration2FhirUpdate.body,
								  method: orchestration2FhirUpdate.method,
								  timestamp: new Date().getTime()
								},
								response: {
								  status: resp.statusCode,
								  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
								  timestamp: new Date().getTime()
								}
								});
								// add orchestration response to context object and return callback
								ctxObject2Update[orchestration2FhirUpdate.ctxObjectRef] = resp.body.toString('utf8');
								counter++;
								callbackFhirUpdate();
							});//end of needle
						},function(err)
						{
							if(err)
							{
								winston.error(err);
							}
							var urn = mediatorConfig.urn;
							var status = 'Successful';
							var response = {
							  status: 200,
							  headers: {
								'content-type': 'application/json'
							  },
							  body:JSON.stringify( {'Requisition_sync_operationd':'success'}),
							  timestamp: new Date().getTime()
							};
							var properties = {};
							properties['Nombre requisitions maj'] =orchestrationsResults2Update.length;
							var returnObject = {
							  "x-mediator-urn": urn,
							  "status": status,
							  "response": response,
							  "orchestrations": orchestrationsResults2Update,
							  "properties": properties
							}
							winston.info("End of eSIGL=>Fhir requisition orchestration");
							var lastSynchedDate=new Date();
							var listOrganizationToLog=[];
							for(var i=0;i<listOrganizationToSync.length;i++)
							{
								var facilityCode=customLibrairy.getFacilityeSiGLCode(listOrganizationToSync[i]);
								listOrganizationToLog.push({
										code:facilityCode,
										lastDateOfRequisitionSync:lastSynchedDate
									});
							}//end for 
							console.log("Organization built to be logged :"+listOrganizationToLog.length);
							customLibrairy.saveAllSynchedOrganizations(listOrganizationToLog,function(resultOperation)
							{
								if(resultOperation)
								{
									winston.info("Batch of facilities "+listOrganizationToLog.length+" synched in the log");
								}
								else
								{
									winston.error("Failed to save the batch of "+listOrganizationToLog.length+" facilities");
								}
								
							});//end saveAllSynchedOrganizations
							res.set('Content-Type', 'application/json+openhim');
							res.send(returnObject);
							
						});
					
					
					
				});//end of async
			
					
				}
				else if (operationType==1)
				{
					//build request to get the list of requisition and related information from the db
					var dayToIncrement=parseInt(config.maxNumberDayRequisitionsToPull);
					
					
					
				}
			});
			
			//console.log("Nombre of orgunit retreived: "+listOrganizations.length);
			//console.log(JSON.stringify(listOrganizations[600]));
		});
		
		/*
		customLibrairy.getAllSynchedOrganization(function (listSynchedOrganizations)
		{
			console.log(listSynchedOrganizations);
			if(listSynchedOrganizations.length>0)
			{
			}
			else //first time or no requisition synched
			{
			}
		});*/
	});//end app.get syncrequisition2fhir
	app.get('/syncrequisition2fhir_apiold', (req, res) => {
		winston.info("***********************Channel for getting requisition triggered*******************************");
		needle.defaults(
		{
			open_timeout: 600000
		});
		winston.info("Start extraction of requisitions from eSIGL...!");
		var orchestrations=[];
		orchestrations = [{ 
			ctxObjectRef: "requisitions",
			name: "requisitions", 
			//domain: mediatorConfig.config.esiglServer.url,
			domain: "http://localhost:8001",
			//path: mediatorConfig.config.esiglServer.resourcespath+"/lookup/programs",
			path: "/requisitionsgen",
			params: "",
			body: "",
			method: "GET",
			//headers: {'Authorization': basicClientToken}
			headers: ""
		  }
		  ];
		var ctxObject=[]; 
		var orchestrationsResults=[]; 
		var listProgramsFromeSIGL=[];
		async.each(orchestrations, function(orchestration, callback) {
			var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
			var options={headers:orchestration.headers};
			winston.info("Querying "+orchestration.ctxObjectRef+"from eSIGL....");
			needle.get(orchUrl,options, function(err, resp) {
				if ( err ){
					callback(err);
				}
				orchestrationsResults.push({
				name: orchestration.name,
				request: {
				  path : orchestration.path,
				  headers: orchestration.headers,
				  querystring: orchestration.params,
				  body: resp.body.requisitions,
				  method: orchestration.method,
				  timestamp: new Date().getTime()
				},
				response: {
				  status: resp.statusCode,
				  body: resp.body.requisitions,
				  timestamp: new Date().getTime()
				}
				});
				ctxObject[orchestration.ctxObjectRef] = resp.body;
				//console.log(ctxObject);
				callback();
			});//end of needle
			
		},function(err)
		{
			if(err)
			{
				winston.error(err);
			}
			
			winston.info("Extracted requisitions form eSIGL done!");
			var globalListRequisitions=[];
			var globalListRequisitionsToProcess=[];
			//globalListRequisitions=orchestrationsResults[0].response.body;
			if(config.periodEndDate=="")
			{
				globalListRequisitions=customLibrairy.geRequisitionsFromStartDate(config.periodStartDate,
			orchestrationsResults[0].response.body);
			}
			else
			{
				globalListRequisitions=customLibrairy.geRequisitionsPeriod(config.periodStartDate,config.periodEndDate,
			orchestrationsResults[0].response.body);
			}
			//console.log(globalListRequisitions);
			//customLibrairy.getAllSynchedRequisitions(function (listSynchedRequisitions)
			customLibrairy.getAllRequisitionPeriodSynched(config.periodStartDate,config.periodEndDate
			,function(listAlreadySynchedRequisitions)
			{
				//console.log(listAlreadySynchedRequisitions[110]);
				//var periodStartDate="";
				//var globalListRequisitionsToProcess=[];
				var listRequisition2Process=[];
				var batchSize=parseInt(config.batchSizeRequisitionToProcess);
				if(listAlreadySynchedRequisitions==null)
				{
					listRequisition2Process=customLibrairy.getRequisitionsNotSynched(config.prefixResourceId,batchSize,[],
					globalListRequisitions);
			
				}
				else
				{
					listRequisition2Process=customLibrairy.getRequisitionsNotSynched(config.prefixResourceId,batchSize,listAlreadySynchedRequisitions,globalListRequisitions);
			
				}
				//res.send("interrupt");
				//console.log(globalListRequisitionsToProcess);
				//return;
				winston.info("Return "+listRequisition2Process.length+" requisition selected from "+config.periodStartDate);
				
				//var listRequisition2Process=customLibrairy.getRequisitionsNotSynched(batchSize,[],globalListRequisitionsToProcess);
				//Now getRequisitionDetails
				var orchestrationsDetailReq=[];
				for(var iteratorReq=0;iteratorReq<listRequisition2Process.length;iteratorReq++)
				{
					orchestrationsDetailReq.push(
					{ 
					ctxObjectRef: listRequisition2Process[iteratorReq].id,
					name: listRequisition2Process[iteratorReq].id, 
					//domain: mediatorConfig.config.esiglServer.url,
					domain: "http://localhost:8001",
					//path: "/requisitionbyid/"+listRequisition2Process[iteratorReq].id,
					path: "/requisitiongenbyid?"+`reqid=${listRequisition2Process[iteratorReq].id}&prog=${listRequisition2Process[iteratorReq].programCode}&fac=${listRequisition2Process[iteratorReq].facilityCode}`,
					params:"",
					body: "",
					method: "GET",
					//headers: {'Authorization': basicClientToken}
					headers: ""
				  });
				}
				//winston.info("")
				var ctxObjectReqDetail = []; 
				var orchestrationsResultsReqDetail=[];
				var counter=1; 
				async.each(orchestrationsDetailReq, function(orchestration, callbackReqDetail) {
					var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
					var options={headers:orchestration.headers};
					winston.info(counter+"/"+orchestrationsDetailReq.length);
					winston.info("Querying requisitions/"+orchestration.ctxObjectRef+" from eSIGL....");
					needle.get(orchUrl,options, function(err, resp) {
						if ( err ){
							callbackReqDetail(err);
						}
						orchestrationsResultsReqDetail.push({
						name: orchestration.name,
						request: {
						  path : orchestration.path,
						  headers: orchestration.headers,
						  querystring: orchestration.params,
						  body: resp.body.requisition,
						  method: orchestration.method,
						  timestamp: new Date().getTime()
						},
						response: {
						  status: resp.statusCode,
						  body: resp.body.requisition,
						  timestamp: new Date().getTime()
						}
						});
						ctxObject[orchestration.ctxObjectRef] = resp.body.requisition;
						//console.log(ctxObject);
						//counter++;
						callbackReqDetail();
					});//end of needle
					counter++;
			},function(err)
			{
				if(err)
				{
					winston.error(err);
				}
				var listRequisitionsDetails=[];
				winston.info("Extraction of requisition details done!")
				for(var iteratorReqDetails=0;iteratorReqDetails<orchestrationsResultsReqDetail.length;iteratorReqDetails++)
				{	
					var foundRequisition=orchestrationsResultsReqDetail[iteratorReqDetails].response.body;
					var oRequisitionDetails={
							id:foundRequisition.id,
							agentCode:foundRequisition.agentCode,
							periodStartDate:foundRequisition.periodStartDate,
							periodEndDate:foundRequisition.periodEndDate,
							products:foundRequisition.products,
							requisitionStatus:foundRequisition.requisitionStatus
						};
					listRequisitionsDetails.push(oRequisitionDetails);
				}
				
				//Then extract Facilities where requisition was made,to get facilityId (dhis2 id) for {Reference:Organization/id}
				var orchestrationsFacilities=[];
				var identifierToProcess=[];
				for(var iteratorFac=0;iteratorFac<listRequisitionsDetails.length;iteratorFac++)
				{
					if(identifierToProcess.includes(listRequisitionsDetails[iteratorFac].agentCode))
					{
						continue;
					}
					orchestrationsFacilities.push(
					{ 
					ctxObjectRef: listRequisitionsDetails[iteratorFac].agentCode,
					name: listRequisitionsDetails[iteratorFac].agentCode, 
					domain: config.hapiServer.url,
					path: "/fhir/Organization?&_format=json&identifier="+listRequisitionsDetails[iteratorFac].agentCode,
					params:"",
					body: "",
					method: "GET",
					//headers: {'Authorization': basicClientToken}
					headers: ""
				  });
				  identifierToProcess.push(listRequisitionsDetails[iteratorFac].agentCode);
				}
				//winston.info("")
				var ctxObjectFacility = []; 
				var orchestrationsResultsFacility=[];
				var counterFacility=1;
				async.each(orchestrationsFacilities, function(orchestration, callbackFacility) {
					var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
					var options={headers:orchestration.headers};
					winston.info(counterFacility+"/"+orchestrationsFacilities.length);
					winston.info("Querying Organization?identifier="+orchestration.ctxObjectRef+" from Hapi....");
					needle.get(orchUrl,options, function(err, resp) {
						if ( err ){
							callbackFacility(err);
						}
						orchestrationsResultsFacility.push({
						name: orchestration.name,
						request: {
						  path : orchestration.path,
						  headers: orchestration.headers,
						  querystring: orchestration.params,
						  body: resp.body.entry!=null?resp.body.entry[0].resource:"",
						  method: orchestration.method,
						  timestamp: new Date().getTime()
						},
						response: {
						  status: resp.statusCode,
						  body: JSON.parse(resp.body.toString('utf8')).entry!=null?JSON.parse(resp.body.toString('utf8')).entry[0].resource:"",
						  timestamp: new Date().getTime()
						}
						});
						ctxObject[orchestration.ctxObjectRef] = resp.body;
						//console.log(resp.body);
						counterFacility++;
						callbackFacility();
					});//end of needle
				},function(err)
				{
					if(err)
					{
						winston.error(err)
					}
					winston.info("Extraction of facility information from requisitions done!");
					var listFacilitiesRequisition=[]
					//Now Build new object related to facilities that contains only facility id and esigl code
					for(var iteratorFac=0;iteratorFac<orchestrationsResultsFacility.length;iteratorFac++)
					{
						var oOrganization=orchestrationsResultsFacility[iteratorFac].response.body;
						//console.log(orchestrationsResultsFacility[iteratorFac].response);
						//return ;
						if(oOrganization!="")
						{
							var oFacility={
								id:oOrganization.id,
								eSiglCode:orchestrationsResultsFacility[iteratorFac].name
								};
							listFacilitiesRequisition.push(oFacility);
						}
					}
					//console.log(listFacilitiesRequisition);
					//Now build the bundle Requisition ressources
					var listRequisitionToPush=customLibrairy.buildRequisitionFhirResourcesNewApi(config.prefixResourceId,listFacilitiesRequisition,
					listRequisitionsDetails,listRequisition2Process,
						config.esiglServer.url,config.hapiServer.url);
					winston.info("Requisitions transformed to Requisition resources done");
					//console.log("Total requisition to process: "+listRequisitionToPush.length);
					
					var orchestrationsRequistition2Push=[];
					for(var iteratorReq=0;iteratorReq<listRequisitionToPush.length;iteratorReq++)
					{
						var oRequisition=listRequisitionToPush[iteratorReq];
						orchestrationsRequistition2Push.push(
							{ 
							ctxObjectRef: oRequisition.id,
							name: oRequisition.id, 
							domain: config.hapiServer.url,
							path: "/fhir/Basic/"+oRequisition.id,
							params: "",
							body:  JSON.stringify(oRequisition),
							method: "PUT",
							headers: {'Content-Type': 'application/json'}
						  });
						
					}
					var asyncFhir2Update = require('async');
					var ctxObject2Update = []; 
					var orchestrationsResults2Update=[];
					var counterPush=1;
					
					asyncFhir2Update.each(orchestrationsRequistition2Push, function(orchestration2FhirUpdate, callbackFhirUpdate) {
						var orchUrl = orchestration2FhirUpdate.domain + orchestration2FhirUpdate.path + orchestration2FhirUpdate.params;
						var options={headers:orchestration2FhirUpdate.headers};
						var requisition2Push=orchestration2FhirUpdate.body;
						needle.put(orchUrl,requisition2Push,{json:true}, function(err, resp) {
							// if error occured
							if ( err ){
								winston.error("Needle: error when pushing program data to hapi");
								callbackFhirUpdate(err);
							}
							winston.info(counterPush+"/"+orchestrationsRequistition2Push.length);
							winston.info("...Inserting "+orchestration2FhirUpdate.path);
							orchestrationsResults2Update.push({
							name: orchestration2FhirUpdate.name,
							request: {
							  path : orchestration2FhirUpdate.path,
							  headers: orchestration2FhirUpdate.headers,
							  querystring: orchestration2FhirUpdate.params,
							  body: orchestration2FhirUpdate.body,
							  method: orchestration2FhirUpdate.method,
							  timestamp: new Date().getTime()
							},
							response: {
							  status: resp.statusCode,
							  body: JSON.stringify(resp.body.toString('utf8'), null, 4),
							  timestamp: new Date().getTime()
							}
							});
							// add orchestration response to context object and return callback
							ctxObject2Update[orchestration2FhirUpdate.ctxObjectRef] = resp.body.toString('utf8');
							
							callbackFhirUpdate();
						});//end of needle
						counterPush++;
						},function(err)
						{
							if(err)
							{
								winston.error(err);
							}
							var urn = mediatorConfig.urn;
							var status = 'Successful';
							var response = {
							  status: 200,
							  headers: {
								'content-type': 'application/json'
							  },
							  body:JSON.stringify( {'Requisition_sync_operationd':'success'}),
							  timestamp: new Date().getTime()
							};
							var properties = {};
							properties['Nombre requisitions maj'] =orchestrationsResults2Update.length;
							var returnObject = {
							  "x-mediator-urn": urn,
							  "status": status,
							  "response": response,
							  "orchestrations": orchestrationsResults2Update,
							  "properties": properties
							}
							winston.info("End of eSIGL=>Fhir requisition orchestration");
							//now keep the log of sync
							////get the maxPeriodStartDate from synched requisition
							customLibrairy.saveAllSynchedRequisitionsPeriod(config.periodStartDate,
								config.periodEndDate,listRequisitionToPush,function(resSync)
								{
									if(resSync)
									{
										winston.info("Requisitons pushed  logged with success");
									}
									else
									{
										winston.warn("Requisitons pushed not logged with success");
									}
									
								});//end customLibrairy.saveAllSynchedRequisitionsPeriod
							//return;
							res.set('Content-Type', 'application/json+openhim');
							res.send(returnObject);
						});//end asynchFhir2Update.each orchestrationsRequistition2Push
					
						
					}); //end of each.sync orchestration facilities
				
			});//end of asynch.each orchestrationsDetailReq
				
			});//end of customLibrairy.getAllSynchedRequisitions
			
			//console.log(orchestrationsResults[0].response.body);
		});//end asyn.each orchestration requisitions
	});//end of app get
	app.get('/syncrequisition2fhir_new', (req, res) => {
		winston.info("***********************Channel for getting requisition triggered*******************************");
		req.setTimeout(600000);
		needle.defaults(
		{
			open_timeout: 600000
		});
		//console.log(res);
		var requisitionStatusToProcess="APPROVED";
		var programCode= config.programsToSync;
		const basicClientToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
		var globalSharedOrganisation=[];
		winston.info("Start extraction of requisitions from eSIGL...!");
		//Only facility with the set levele and which the boby contains siglcode will be considered
		var levelOrganizationCode=config.facilityLevesForRequisitions;
		var filter="identifier:text=siglcode&_sort=type&_pretty=true&_count=2";
		var operationType=0 //0 to get requisition from API and one to get requisition from dbs
		
		var periodStartDate=config.periodStartDate;
		var periodEndDate=config.periodEndDate;
		customLibrairy.getFhirLogOffSet(periodStartDate,periodEndDate,programCode,function(currentOffSet)
		{
			
			//console.log("Current offset:"+currentOffSet);
			var _currentOffSet=currentOffSet;
			//return;
			
			getAllOrganizationsCurlWithCurrentOffset(_currentOffSet,"",filter,globalSharedOrganisation,function(dicRes)
			{
				winston.info("Get organizations that gas mapping siglCode to get their requisitions.Done!!");
				//now  get all organization already synched during the defined period for requisitons from mongodb log db
				//
				var listOrganizations=dicRes[1];
				var newOffSet=dicRes[0];
				//console.log(listOrganizations);
				customLibrairy.updateFhirLogOffSet(periodStartDate,periodEndDate,programCode,newOffSet,function(upDateres)
				{
					//console.log(res);
					console.log("Returned updateFhirLogOffSet");
					customLibrairy.getAllOrganizationPeriodSynched(config.periodStartDate,config.periodEndDate,programCode,function (listSynchedOrganizations)
					{
						var listOrganizationToSync=[];
						var batchSize=parseInt(config.batchSizeRequisitionFacilities);
						//console.log(listSynchedOrganizations);
						if(listSynchedOrganizations.length>0)
						{
							//console.log("Synched organization "+listSynchedOrganizations.length);
							winston.info("Limit the batch on the organizations based on the previous sync...");
							listOrganizationToSync=customLibrairy.getOrganizationsNotSynched(batchSize,listSynchedOrganizations,listOrganizations);
						}
						else
						{
							listOrganizationToSync=customLibrairy.getOrganizationsNotSynched(batchSize,[],listOrganizations);
						}
						//console.log(listSynchedOrganizations);
						//Now build orchestrator to get requisition by facility
						winston.info("Start extraction of requisitions from eSIGL...!");
						var orchestrations=[];
						for(var indexFacility=0;indexFacility<listOrganizationToSync.length; indexFacility++)
						{
							var organization=listOrganizationToSync[indexFacility];
							var eSiglCode=customLibrairy.getFacilityeSiGLCode(organization);
							
							orchestrations.push(
								{ 
								ctxObjectRef: eSiglCode,
								name: organization.id, 
								domain: config.esiglServer.url,
								path: "/rest-api/requisitions",
								params:"?facilityCode="+eSiglCode,
								body: "",
								method: "GET",
								headers: {'Authorization': basicClientToken}
							  });
						}
						var ctxObject = []; 
						var orchestrationsResults=[]; 
						var listRequisitionsFromeSIGL=[];
						var counter=1; 
						async.each(orchestrations, function(orchestration, callback) {
							var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
							//console.log(orchUrl);
							var options={headers:orchestration.headers};
							winston.info(counter+"/"+orchestrations.length);
							winston.info("Querying requisitions/"+orchestration.ctxObjectRef+" from eSIGL....");
							needle.get(orchUrl,options, function(err, resp) {
								if ( err ){
									callback(err);
								}
								orchestrationsResults.push({
								name: orchestration.name,
								ctxObjectRef:orchestration.ctxObjectRef,
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
								  body: JSON.stringify(resp.body.requisitions, null, 4),
								  timestamp: new Date().getTime()
								}
								});
								ctxObject[orchestration.ctxObjectRef] = resp.body;
								callback();
							});//end of needle
						counter++;
						},function(err)
						{
							if(err)
							{
								winston.error(err);
								
							}
							winston.info("Requisitions extracted from eSIGL...");
							var globalListRequisitions=[]
							for(var iteratorRes=0;iteratorRes<orchestrationsResults.length;iteratorRes++)
							{
								var oResultOrchestration=orchestrationsResults[iteratorRes];
								var responseBody=JSON.parse(oResultOrchestration.response.body);
								console.log(oResultOrchestration.name +" |requisition found :"+responseBody.length);
								var listRequisitionByFacility=customLibrairy.geRequisitionsPeriod(config.periodStartDate,
									config.periodEndDate,responseBody);
								//now assign the requisition to the global list 
								for(var indexGlobal=0;indexGlobal<listRequisitionByFacility.length;indexGlobal++)
								{
									globalListRequisitions.push(listRequisitionByFacility[indexGlobal]);
								}
							}
							console.log(`Total retained based on Period ${config.periodStartDate} - ${config.periodEndDate}:${globalListRequisitions.length}`);
							customLibrairy.getAllRequisitionPeriodSynched(config.periodStartDate,config.periodEndDate,programCode
							,function(listAlreadySynchedRequisitions)
							{
								var listRequisition2Process=[];
								var batchSizeReq2Process=parseInt(config.batchSizeRequisitionToProcess);
								console.log("Batchsize :"+batchSizeReq2Process);
								var listProgramToProcess=config.programsToSync.split(",");
								
								if(listAlreadySynchedRequisitions==null)
								{
									listRequisition2Process=customLibrairy.getRequisitionsNotSynched(config.prefixResourceId,
										batchSizeReq2Process,[],globalListRequisitions,listProgramToProcess);
								}
								else
								{
									listRequisition2Process=customLibrairy.getRequisitionsNotSynched(config.prefixResourceId,batchSizeReq2Process,
									listAlreadySynchedRequisitions,globalListRequisitions,listProgramToProcess);
								}
								winston.info("Return "+listRequisition2Process.length+" requisition selected from "+config.periodStartDate+" to "+config.periodEndDate);
								var orchestrationsDetailReq=[];
								//console.log(JSON.stringify(listRequisition2Process[0]));
								for(var iteratorReq=0;iteratorReq<listRequisition2Process.length;iteratorReq++)
								{
									orchestrationsDetailReq.push(
									{ 
										ctxObjectRef: listRequisition2Process[iteratorReq].id,
										name: listRequisition2Process[iteratorReq].id, 
										domain: config.esiglServer.url,
										path: "/rest-api/requisitions/"+listRequisition2Process[iteratorReq].id,
										params:"",
										body: "",
										method: "GET",
										headers: {'Authorization': basicClientToken}
										//headers: ""
								  });
								}
								var ctxObjectReqDetail = []; 
								var orchestrationsResultsReqDetail=[];
								var counter=1; 
								async.each(orchestrationsDetailReq, function(orchestration, callbackReqDetail) {
								var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
								var options={headers:orchestration.headers};
								winston.info(counter+"/"+orchestrationsDetailReq.length);
								winston.info("Querying requisitions/"+orchestration.ctxObjectRef+" from eSIGL....");
								needle.get(orchUrl,options, function(err, resp) {
									if ( err ){
										callbackReqDetail(err);
									}
									orchestrationsResultsReqDetail.push({
									name: orchestration.name,
									request: {
									  path : orchestration.path,
									  headers: orchestration.headers,
									  querystring: orchestration.params,
									  body: resp.body.requisition,
									  method: orchestration.method,
									  timestamp: new Date().getTime()
									},
									response: {
									  status: resp.statusCode,
									  body: resp.body.requisition,
									  timestamp: new Date().getTime()
									}
									});
									ctxObject[orchestration.ctxObjectRef] = resp.body.requisition;
									//console.log(ctxObject);
									//counter++;
									callbackReqDetail();
								});//end of needle
								counter++;
								},function(err)
								{
									if(err)
									{
										winston.error(err);
									}
									var listRequisitionsDetails=[];
									winston.info("Extraction of requisition details done!")
									for(var iteratorReqDetails=0;iteratorReqDetails<orchestrationsResultsReqDetail.length;iteratorReqDetails++)
									{	
										var foundRequisition=orchestrationsResultsReqDetail[iteratorReqDetails].response.body;
										var oRequisitionDetails={
												id:foundRequisition.id,
												agentCode:foundRequisition.agentCode,
												periodStartDate:foundRequisition.periodStartDate,
												periodEndDate:foundRequisition.periodEndDate,
												products:foundRequisition.products,
												requisitionStatus:foundRequisition.requisitionStatus
											};
										listRequisitionsDetails.push(oRequisitionDetails);
									}
									//Then  facilityId (dhis2 id) for {Reference:Organization/id}
									//Now build the bundle Requisition ressources                                                                                                                                                                                                                                                                                                                                                            
									//var listRequisitionToPush=customLibrairy.buildRequisitionFhirResourcesNewApi(requisitionStatusToProcess,mediatorConfig.config.prefixResourceId,listOrganizationToSync,
									//listRequisitionsDetails,listRequisition2Process,mediatorConfig.config.esiglServer.url,mediatorConfig.config.hapiServer.url);
									var listRequisitionToPush=customLibrairy.buildRequisitionFhirResourcesNewApiByProducts(requisitionStatusToProcess,config.prefixResourceId,listOrganizationToSync,
									listRequisitionsDetails,listRequisition2Process,config.esiglServer.url,config.hapiServer.url);
									winston.info("Requisitions transformed to Requisition resources done: "+listRequisitionToPush.length);
									//console.log(listRequisitionToPush.length);
									//console.log("---------------------------------------");
									//console.log(JSON.stringify(listRequisitionToPush[0]));
									//return;
									var orchestrationsRequistition2Push=[];
									for(var iteratorReq=0;iteratorReq<listRequisitionToPush.length;iteratorReq++)
									{
										var oRequisition=listRequisitionToPush[iteratorReq];
										orchestrationsRequistition2Push.push(
											{ 
											ctxObjectRef: oRequisition.id,
											name: oRequisition.id, 
											domain: config.hapiServer.url,
											path: "/fhir/Basic/"+oRequisition.id,
											params: "",
											body:  JSON.stringify(oRequisition),
											method: "PUT",
											headers: {'Content-Type': 'application/json'}
										  });
										
									}
									var asyncFhir2Update = require('async');
									var ctxObject2Update = []; 
									var orchestrationsResults2Update=[];
									var counterPush=1;
									asyncFhir2Update.each(orchestrationsRequistition2Push, function(orchestration2FhirUpdate, callbackFhirUpdate) {
									var orchUrl = orchestration2FhirUpdate.domain + orchestration2FhirUpdate.path + orchestration2FhirUpdate.params;
									var options={headers:orchestration2FhirUpdate.headers};
									var requisition2Push=orchestration2FhirUpdate.body;
									var urlRequest=orchUrl;
									winston.info(counterPush+"/"+orchestrationsRequistition2Push.length);
									winston.info("...Inserting "+orchestration2FhirUpdate.path);
									var args = "-X "+orchestration2FhirUpdate.method+" -H 'Content-Type: application/fhir+json' '"+urlRequest+"' "+" -d '"+requisition2Push+"' ";
									var exec = require('child_process').exec;
									exec('curl ' + args, function (error, stdout, stderr) {
										if (error !== null) {
											console.log('exec error: ' + error);
											callbackFhirUpdate(error);
										  }
										//console.log(stdout);
										
										orchestrationsResults2Update.push({
										name: orchestration2FhirUpdate.name,
										request: {
										  path : orchestration2FhirUpdate.path,
										  headers: orchestration2FhirUpdate.headers,
										  querystring: orchestration2FhirUpdate.params,
										  body: "",
										  method: orchestration2FhirUpdate.method,
										  timestamp: new Date().getTime()
										},
										response: {
										  status: 200,
										  body: JSON.stringify(stdout, null, 4),
										  timestamp: new Date().getTime()
										}
										});
										// add orchestration response to context object and return callback
										ctxObject2Update[orchestration2FhirUpdate.ctxObjectRef] = stdout;
										callbackFhirUpdate();
										
									});//end of exec
									
									
									counterPush++;
									},function(err)
									{
										if(err)
										{
											winston.error(err);
										}
										
										//winston.info("End of eSIGL=>Fhir requisition orchestration");
										var listSyncProcess=[1,2];
										var asyncLogs = require('async');
										asyncLogs.each(listSyncProcess, function(syncProcess, callbackProcessSync) {
											if(syncProcess==1)
											{
												customLibrairy.saveAllSynchedRequisitionsPeriod(config.periodStartDate,
												config.periodEndDate,programCode,listRequisitionToPush,function(resSync)
												{
													if(resSync)
													{
														winston.info("Requisitons pushed  logged with success");
													}
													else
													{
														winston.warn("Requisitons pushed not logged with success");
													}
													
												});
												callbackProcessSync();
											}
											else if (syncProcess==2)
											{
												customLibrairy.saveAllSynchedOrganizationPeriod(config.periodStartDate,
												config.periodEndDate,programCode,listOrganizationToSync,function(resSync)
												{
													if(resSync)
													{
														winston.info("Organization pushed  logged with success");
													}
													else
													{
														winston.warn("Organization pushed not logged with success");
													}
												});
												callbackProcessSync();
											}
											
										},function(err)
										{
											if(err)
											{
												winston.erro(err);
											}
											winston.info("---------------End of eSIGL=>Fhir requisition orchestration------------------");
											var urn = mediatorConfig.urn;
											var status = 'Successful';
											var response = {
											  status: 200,
											  headers: {
												'content-type': 'application/json'
											  },
											  body:JSON.stringify( {'Requisition_sync_operationd':'success'}),
											  timestamp: new Date().getTime()
											};
											var properties = {};
											properties['Nombre requisitions maj'] =orchestrationsResults2Update.length;
											var returnObject = {
											  "x-mediator-urn": urn,
											  "status": status,
											  "response": response,
											  "orchestrations": orchestrationsResults2Update,
											  "properties": properties
											}
											//console.log(returnObject);
											//console.log(res);
											res.set('Content-Type', 'application/json+openhim');
											res.send(returnObject);
										});//end asyncLogs
											
									})//end asyncFhir2Update OrchestrationRequisition to push
									//console.log(listRequisitionToPush[0]);	
									//return ;
								});//end async orchestrationsDetailReq
								
								
							});//end of customLibrairy.getAllRequisitionPeriodSynched
						});//end of async orchestration
						
					});//end of customLibrairy.getAllOrganizationPeriodSynched
				
				});
				//return;
				
			});//end of getAllOrganizationsCurl
	
			
			
			
		})//end ustomLibrairy.getFhirLofOffSet
		
	});//end of app.get syncrequisition2fhir_new
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
		urlRequest=`${config.hapiServer.url}/fhir/Organization?_count=2&${filter}`;
		
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
function getAllOrganizationsCurl(bundleParam,filter,globalStoredList,callback)
{
	console.log("Entered old function!!!");
	var urlRequest="";
	if(bundleParam=="")
	{
		urlRequest="'"+`${config.hapiServer.url}/fhir/Organization?${filter}`+"'";
		winston.info("First iteration!")
	}
	else
	{
		urlRequest="'"+`${bundleParam}`+"'";
		winston.info("Looping througth bundle response to construct organization list!");
	}
	console.log(urlRequest);
	var args = "-X GET  -H 'Content-Type: application/fhir+json' "+urlRequest;
	var exec = require('child_process').exec;
	exec('curl ' + args, function (error, stdout, stderr) {
      //console.log('stdout: ' + stdout);
      //console.log('stderr: ' + stderr);
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
				//if(hasNextPageBundle==true && globalStoredList.length<30)
				if(hasNextPageBundle==true)
				//if(false)
				{
					//console.log();
					//onsole.log("---------------------------------");
					getAllOrganizationsCurl(nextPageUrl,"",globalStoredList,callback);
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
function getAllOrganizationsCurlWithCurrentOffset(currentOffSet,bundleParam,filter,globalStoredList,callback)
{
	console.log("Entered new function!!!");
	var urlRequest="";
	if(bundleParam=="")
	{
		urlRequest="'"+`${config.hapiServer.url}/fhir/Organization?${filter}`+"'";
		winston.info("First iteration!")
	}
	else
	{
		urlRequest="'"+`${bundleParam}`+"'";
		winston.info("Looping througth bundle response to construct organization list!");
	}
	console.log(urlRequest);
	var args = "-X GET  -H 'Content-Type: application/fhir+json' "+urlRequest;
	var exec = require('child_process').exec;
	exec('curl ' + args, function (error, stdout, stderr) {
      //console.log('stdout: ' + stdout);
      //console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
        callback(error);
      }
      var responseBundle=JSON.parse(stdout);
		if(responseBundle.entry!=null && currentOffSet==0)
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
				//if(hasNextPageBundle==true && globalStoredList.length<30)
				var batchSizeRequisitionFacilities= parseInt (config.batchSizeRequisitionFacilities);
				console.log("Global store list size="+globalStoredList.length)
				if(hasNextPageBundle==true && globalStoredList.length<batchSizeRequisitionFacilities)
				//if(false)
				{
					//console.log();
					//onsole.log("---------------------------------");
					getAllOrganizationsCurlWithCurrentOffset(currentOffSet,nextPageUrl,"",globalStoredList,callback);
				}
				else
				{
					//return callback(globalStoredList);
					var offSetNumber=getPageOffSetFromUrl(nextPageUrl);
					return callback([offSetNumber,globalStoredList]);
				}
				
			}
		}//end if responseBundle.entry
		else if(responseBundle.entry!=null && currentOffSet>0)
		{
			if(responseBundle.link.length>0 && bundleParam=="")
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
				//if(hasNextPageBundle==true && globalStoredList.length<30)
				var batchSizeRequisitionFacilities= parseInt (config.batchSizeRequisitionFacilities);
				if(hasNextPageBundle==true && globalStoredList.length<batchSizeRequisitionFacilities)
				//if(false)
				{
					//console.log();
					//onsole.log("---------------------------------");
					//now reformat the url to point the correct offset
					var urlComponents=nextPageUrl.split("&");
					var indexPageOffSet=-1;
					var stringToReplace="";
					for(var indexUrl=0;indexUrl<urlComponents.length;indexUrl++)
					{
						if(urlComponents[indexUrl].includes("_getpagesoffset="))
						{
							indexPageOffSet=indexUrl;
							stringToReplace=urlComponents[indexUrl];
							break;
						}
					}
					
					var newNextPageUrl="";
					if(indexPageOffSet!=-1)
					{
						var newOffSet=currentOffSet+2;
						var item="_getpagesoffset="+newOffSet;
						newNextPageUrl=nextPageUrl.replace(stringToReplace,item);
					}
					else
					{
						newNextPageUrl=nextPageUrl;
					}
					getAllOrganizationsCurlWithCurrentOffset(currentOffSet,newNextPageUrl,"",globalStoredList,callback);
				}
				else
				{
					 //return callback(globalStoredList);
					var offSetNumber=getPageOffSetFromUrl(nextPageUrl);
					return callback([offSetNumber,globalStoredList]);
				}
				
			}//end if responseBundle.link.length
			else if(responseBundle.link.length>0 && bundleParam!="")
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
					//if(hasNextPageBundle==true && globalStoredList.length<30)
					var batchSizeRequisitionFacilities= parseInt (config.batchSizeRequisitionFacilities);
					console.log("Global store list size="+globalStoredList.length)
					if(hasNextPageBundle==true && globalStoredList.length<batchSizeRequisitionFacilities)
					//if(false)
					{
						//console.log();
						//onsole.log("---------------------------------");
						getAllOrganizationsCurlWithCurrentOffset(currentOffSet,nextPageUrl,"",globalStoredList,callback);
					}
					else
					{
						var offSetNumber=getPageOffSetFromUrl(nextPageUrl);
						return callback([offSetNumber,globalStoredList]);
					}
					
				}//end if responseBundle.link.length
			}//end else if responseBundle.link.length>0 && bundleParam!=""
		}//end else responseBundle.entry!=null && currentOffSet>
      //callback();
    });
}
function getPageOffSetFromUrl(url)
{
	var urlComponents=url.split("&");
	var offSetNumber=0;
	for(var indexUrl=0;indexUrl<urlComponents.length;indexUrl++)
	{
		if(urlComponents[indexUrl].includes("_getpagesoffset="))
		{
			//indexPageOffSet=indexUrl;
			offSetNumber=parseInt(urlComponents[indexUrl].split("=")[1]);
			break;
		}
	}
	return offSetNumber;
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
