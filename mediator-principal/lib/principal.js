#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const URI = require('urijs');
const isJSON = require('is-json');
const path = require('path');
var btoa = require('btoa');
//const winston = require('winston')
const {createLogger,format,transports} = require('winston');
const { combine, timestamp, label, printf } = format;
const customLibrairy=require('./lib.js');

// Logging setup
var globalRes;
var orgUnitResource="organisationUnits";
var faciliyResource="facilities";
var typeOperation ={
    startTheService:"Start",
    stopTheService:"Stop",
    getData:"Get",
    postData:"Post",
    putData:"Put",
    deleteData:"Delete",
    normalProcess:"Process"
};
var typeResult={
    success:"Success",
    failed:"Failed",
    iniate:"Initiate",
    ongoing:"ongoing"
};
var levelType={
    info:"info",
    error:"error",
    warning:"warning"
};
var mediatorName="mediateur_principal";
const myFormat = printf(({ level, message, label, timestamp,operationType,action,result }) => {
    return `${timestamp},${level},${label},${operationType},${action},${result},${message}`;
  });
// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = process.env.NODE_ENV === 'test' ? require('../config/test') : require('../config/config')
const mediatorConfig = require('../config/mediator')

var port = process.env.NODE_ENV === 'test' ? 7001 : mediatorConfig.endpoints[0].port

//----------------------------Define logger information -------------------------------------/
var currentDate=new Date();
var filePath=mediatorConfig.config.appDirectory;
var logFileName=path.join(filePath,`/logs/mediator_activities_${currentDate.getMonth()}-${currentDate.getFullYear()}.log`);
  const logger = createLogger({
    format: combine(
      label({ label: mediatorName }),
      timestamp(),
      myFormat
    ),
    transports: [new transports.Console(),
        //new transports.File({ filename: errorFilemane, level: 'error' }),
        new transports.File({ filename: logFileName })
    ]
  });

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
  
  //-------- routes -------------------------//
	app.get("/error",(req, res)=>{
	res.send({});
  });//end get(/error)
  app.get('/loadlogs',(req, res) => {
    globalRes=res;
    customLibrairy.readLogCSVFile(filePath,function(fileLogs){
        var elasticSearchUrl=config.elasticsearchServer.url;
        const esToken = `Basic ${btoa(config.elasticsearchServer.username+':'+config.elasticsearchServer.password)}`;
        var url= URI(elasticSearchUrl);
        var async = require('async');
        
        async.eachSeries(fileLogs, (fileLog, nextLogFile) => { 
            let url= URI(elasticSearchUrl).segment(fileLog.fileName).segment("logs");
            url=url.toString();
            saveEntryToElastic(url,esToken,fileLog.data,function(responseCollection){
                nextLogFile();

            }) 
            //console.log(fileLog);nextLogFile();

        },function(err)
        {
          let urn = mediatorConfig.urn;
          let status = 'Successful';
          let response = {
            status: 200,
            headers: {
            'content-type': 'application/json'
            },
            body:JSON.stringify( {'Process':`${fileLogs[0].data.length} logs ont ete charges avec success dans ES`}),
            timestamp: new Date().getTime()
          };
          var orchestrationToReturn=[
            {
              name: "loadlog",
              request: {
                path :"/loadlog",
                headers: {'Content-Type': 'application/json'},
                querystring: "",
                body:JSON.stringify( {'Process':`${fileLogs[0].data.length} logs a charger dans ES`}),
                method: "POST",
                timestamp: new Date().getTime()
              },
              response: response
            }
          ];
          var returnObject = {
            "x-mediator-urn": urn,
            "status": status,
            "response": response,
            "orchestrations": orchestrationToReturn,
            "properties": ""
          }
          res.set('Content-Type', 'application/json+openhim');
				  res.send(returnObject);
        });
    });
  });
	app.get('/syncorgunit2fhir', (req, res) => {
        
        globalRes=res;
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncorgunit2fhir",result:typeResult.iniate,
        message:`Lancement de la synchro des orgunits DHIS2=>HAPI`});
        const dhis2Token = `Basic ${btoa(config.dhis2Server.username+':'+config.dhis2Server.password)}`;
        const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
        getListDHIS2OrgUnit(dhis2Token,function(listOrgUnits)
        {
            //res.send(listOrgUnits);
            if(listOrgUnits.length>0)
            {
                let bundle=customLibrairy.buildLocationHierarchy(listOrgUnits);
                logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${orgUnitResource}.json`,result:typeResult.success,
        message:`${listOrgUnits.length} structures extraits de DHIS2`});
                //res.send(bundle);
                logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/Location",result:typeResult.iniate,
                        message:`Lancement de la synchronisation des structures dans HAPI`});
                saveBundle2Fhir(hapiToken,'Location',bundle,function(hapiServerResponse)
                {
                  //console.log(hapiServerResponse.status);
                    if(hapiServerResponse.status==200)
                    {
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/Location",result:typeResult.success,
                        message:`${hapiServerResponse.message}`});
                        //res.send(hapiServerResponse);
                        let urn = mediatorConfig.urn;
                        let status = 'Successful';
                        let response = {
                          status: 200,
                          headers: {
                          'content-type': 'application/json'
                          },
                          body:JSON.stringify( {'Process':`${bundle.entry.length} Location ont ete charger avec success dans HAPI FHIR`}),
                          timestamp: new Date().getTime()
                        };
                        var orchestrationToReturn=[
                          {
                            name: "Location",
                            request: {
                              path :"/Location",
                              headers: {'Content-Type': 'application/json'},
                              querystring: "",
                              body:JSON.stringify( {'Process':`${bundle.entry.length} Location a charger dans HAPI FHIR`}),
                              method: "POST",
                              timestamp: new Date().getTime()
                            },
                            response: response
                          }];
                        var returnObject = {
                          "x-mediator-urn": urn,
                          "status": status,
                          "response": "",
                          "orchestrations": orchestrationToReturn,
                          "properties": ""
                        }
                        res.set('Content-Type', 'application/json+openhim');
                        res.send(returnObject);
                    }
                    else{
                        logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/Location",result:typeResult.failed,
                        message:`${hapiServerResponse.message}`});
                        //res.send(hapiServerResponse);
                        let urn = mediatorConfig.urn;
                        let status = 'Successful';
                        let response = {
                          status: 200,
                          headers: {
                          'content-type': 'application/json'
                          },
                          body:JSON.stringify( {'Process':`${hapiServerResponse.message}`}),
                          timestamp: new Date().getTime()
                        };
                        var orchestrationToReturn=[
                          {
                            name: "Location",
                            request: {
                              path :"/Location",
                              headers: {'Content-Type': 'application/json'},
                              querystring: "",
                              body:JSON.stringify( {'Process':`${bundle.entry.length} Location a charger dans HAPI FHIR`}),
                              method: "POST",
                              timestamp: new Date().getTime()
                            },
                            response: response
                          }];
                        var returnObject = {
                          "x-mediator-urn": urn,
                          "status": status,
                          "response": "",
                          "orchestrations": orchestrationToReturn,
                          "properties": ""
                        }
                        res.set('Content-Type', 'application/json+openhim');
                        res.send(returnObject);
                    }
                });//end saveBundle2Fhir
            }
            else
            {
                logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncorgunit2fhir",result:typeResult.failed,
        message:`0 orgunit retourné`});
            }
        });//end of getListDHIS2OrgUnit

  });//end get(/syncorgunit2fhir)
  app.get('/mapfacility2fhir', (req, res) => {
    globalRes=res;
    var listeSIGLStrutures=[];
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/mapfacility2fhir",result:typeResult.iniate,
    message:`Lancement du processus de mapping des structures eSIGL=>DHIS2`});
    const eSIGLToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    customLibrairy.readeSIGLDataCSVFile(filePath,function(listStructures){
      logger.log({level:levelType.info,operationType:typeOperation.getData,action:`Lecture du fichier CSV des structures`,result:typeResult.success,
        message:`${listStructures.length} structures extraits de du fichier`});
      //res.send(listStructures);
      listeSIGLStrutures=listStructures;
      customLibrairy.readMappingCSVFile(filePath,function(mappingList){
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`Lecture du fichier CSV de mapping`,result:typeResult.success,
        message:`${mappingList.length} mapping extraits de du fichier`});
        var listLocationIds=[];
        for(let mappingElement of mappingList)
        {
          listLocationIds.push(mappingElement.dhis2);
        }
        getListHAPILocationByIds(hapiToken,listLocationIds,function(listLocationToMap){
          logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/Location`,result:typeResult.success,
        message:`${listLocationToMap.length} structures resolues pour mapping`});
          let updatedLocationBundle=customLibrairy.updateLocationFromSIGL(listLocationToMap,config.esiglServer.url,listeSIGLStrutures,mappingList);
          //console.log()
          //res.send(updatedLocationBundle);
          if(updatedLocationBundle.entry && updatedLocationBundle.entry.length>=1)
          {
            logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/Location`,result:typeResult.iniate,
          message:`${listLocationToMap.length} structures a mapper`});

            saveBundle2Fhir(hapiToken,'Location',updatedLocationBundle,function(hapiServerResponse)
            {
              //console.log(hapiServerResponse.status);
                if(hapiServerResponse.status==200)
                {
                    logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/Location",result:typeResult.success,
                    message:`${hapiServerResponse.message}: ${updatedLocationBundle.entry.length} structures mappes`});
                    //res.send(hapiServerResponse);
                    let urn = mediatorConfig.urn;
                    let status = 'Successful';
                    let response = {
                      status: 200,
                      headers: {
                      'content-type': 'application/json'
                      },
                      body:JSON.stringify( {'Process':`${updatedLocationBundle.entry.length} Location ont ete mise a jour avec success dans HAPI FHIR`}),
                      timestamp: new Date().getTime()
                    };
                    var orchestrationToReturn=[
                      {
                        name: "Location",
                        request: {
                          path :"/Location",
                          headers: {'Content-Type': 'application/json'},
                          querystring: "",
                          body:JSON.stringify( {'Process':`${updatedLocationBundle.entry.length} Location a mettre a jour dans HAPI FHIR`}),
                          method: "POST",
                          timestamp: new Date().getTime()
                        },
                        response: response
                      }];
                    var returnObject = {
                      "x-mediator-urn": urn,
                      "status": status,
                      "response": response,
                      "orchestrations": orchestrationToReturn,
                      "properties": ""
                    }
                    res.set('Content-Type', 'application/json+openhim');
                    res.send(returnObject);
                }
                else{
                    logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/Location",result:typeResult.failed,
                    message:`${hapiServerResponse.message}`});
                    //res.send(hapiServerResponse);
                    let urn = mediatorConfig.urn;
                    let status = 'Successful';
                    let response = {
                      status: 200,
                      headers: {
                      'content-type': 'application/json'
                      },
                      body:JSON.stringify( {'Process':`${hapiServerResponse.message}`}),
                      timestamp: new Date().getTime()
                    };
                    var orchestrationToReturn=[
                      {
                        name: "Location",
                        request: {
                          path :"/Location",
                          headers: {'Content-Type': 'application/json'},
                          querystring: "",
                          body:JSON.stringify( {'Process':`${updatedLocationBundle.entry.length} Location a charger dans HAPI FHIR`}),
                          method: "POST",
                          timestamp: new Date().getTime()
                        },
                        response: response
                      }];
                    var returnObject = {
                      "x-mediator-urn": urn,
                      "status": status,
                      "response": response,
                      "orchestrations": orchestrationToReturn,
                      "properties": ""
                    }
                    res.set('Content-Type', 'application/json+openhim');
                    res.send(returnObject);
                }
            }); //end saveBundle2Fhir

          }//end if updatedLocationBundle.entry
          else{
            logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/Location",result:typeResult.failed,
            message:`Bundle de mapping invalid`});
            //res.send(hapiServerResponse);
            let urn = mediatorConfig.urn;
            let status = 'Successful';
            let response = {
              status: 200,
              headers: {
              'content-type': 'application/json'
              },
              body:JSON.stringify( {'Process':`Bundle de mapping invalid`}),
              timestamp: new Date().getTime()
            };
            var orchestrationToReturn=[
              {
                name: "Location",
                request: {
                  path :"/Location",
                  headers: {'Content-Type': 'application/json'},
                  querystring: "",
                  body:JSON.stringify( {'Process':`Bundle de mapping invalid`}),
                  method: "POST",
                  timestamp: new Date().getTime()
                },
                response: response
              }];
            var returnObject = {
              "x-mediator-urn": urn,
              "status": status,
              "response": response,
              "orchestrations": orchestrationToReturn,
              "properties": ""
            }
            res.set('Content-Type', 'application/json+openhim');
            res.send(returnObject);
          }//end else updatedLocationBundle.entry
          

        });//end getListHAPILocationByIds

        //res.send(listeSIGLStrutures);


      });//end of customLibrairy.readMappingCSVFile


    });//end of customLibrairy.readeSIGLDataCSVFile
  });
  return app
}
function saveEntryToElastic(url,esToken,logEntries,callbackMain)
{
    let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let async=require('async');
    var responseCollection=[];
	let options={headers:{'Content-Type': 'application/json','Authorization':esToken}};
	var logCounter=1;
    async.each(logEntries, function(logEntry, callback) {
        logCounter++;
        localNeedle.post(url,JSON.stringify(logEntry),options,function(err,resp){
            if(err)
            {
                console.log(err);
            }
			if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
          console.log(`Code d'erreur http: ${resp.statusCode}`);
				//return callback(true, false);
			}
			else{
				var response={
					status: resp.statusCode,
					boby: resp.body,
					timestamp:new Date().getTime()
				}
        responseCollection.push(response);
        console.log(`Insertion du log dans Elasticsearch`);
			}
            callback();
        }); //end of localNeedle.post

    },function(err){
        if(err)
        {
            console.log(err);
        }
        callbackMain(responseCollection);
    });//end of aysnc.each
    
}
function getListDHIS2OrgUnit(dhis2Token,callbackMain){
    let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let localAsync = require('async');
    var resourceData = [];
    var url= URI(config.dhis2Server.url).segment(orgUnitResource+".json");
    url.addQuery('order', "level:asc");
    url.addQuery('pageSize',config.batchSizeFacilityToSync);
    url.addQuery('fields',"href,id,code,level,parent,displayName");
    url = url.toString();
    localAsync.whilst(
        callback => {
            return callback(null, url !== false);
          },
        callback => {
            
            var options={headers:{'Authorization':dhis2Token}};
            localNeedle.get(url,options, function(err, resp) {
                url = false;
                if (err) {
					logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${orgUnitResource}`,result:typeResult.failed,
                        message:`${err.message}`});
                }
                if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
					logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${orgUnitResource}`,result:typeResult.failed,
                        message:`Code d'erreur http: ${resp.statusCode}`});
                    return callback(true, false);
                }
                var body = resp.body;
                //var body = JSON.parse(resp.body);
                if (!body.organisationUnits) {
					logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${orgUnitResource}`,result:typeResult.failed,
                        message:`Ressources invalid retournees par DHIS2`});
                    return callback(true, false);
                }
                if (body.pager.total === 0) {
					logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${orgUnitResource}`,result:typeResult.failed,
                        message:`Pas de ressources retournees par DHIS - page: ${body.pager.page}`});
                    return callback(true, false);
                }

                if (body.organisationUnits && body.organisationUnits.length > 0) {
					logger.log({level:levelType.info,operationType:typeOperation.getData,action:`getListDHIS2OrgUnit page:${body.pager.page}/${body.pager.pageCount}`,
					result:typeResult.success,message:`Extraction de  ${body.organisationUnits.length} orgunits de DHIS2`});
                    resourceData = resourceData.concat(body.organisationUnits);
                    //force return only one loop data
                    //return callback(true, false);
                }
                const next = body.pager.nextPage;

                if(next)
                {
                    url = next;
                }
                return callback(null, url);
            })//end of needle.get
              
        },//end callback 2
        err=>{
            return callbackMain(resourceData);

        }
    );//end of async.whilst
}
function getListHAPILocationByIds(hapiToken,listLocationIds,callbackMain){
  let localNeedle = require('needle');
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
  let localAsync = require('async');
  var listLocationsToMap = [];
  var currentIdToFetch="";
  
  localAsync.eachSeries(listLocationIds, function(locationId, callback) {
    currentIdToFetch=locationId;
    var url= URI(config.hapiServer.url).segment('Location').segment(locationId); 
    url=url.toString();
    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/Location/${locationId}`,result:typeResult.iniate,
      message:`Mapping: Extraction de la structure`}); 
    localNeedle.get(url,options, function(err, resp) {
      if(err)
      {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/Location/${locationId}`,result:typeResult.failed,
      message:`${err.message}`});
      }
      if (resp.statusCode && (resp.statusCode == 200)) {
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/Location/${locationId}`,result:typeResult.ongoing,
      message:`Mapping: Structure extraite`}); 
        listLocationsToMap.push(JSON.parse(resp.body.toString('utf8')));
      }
      //To force break of the eachseries.loop
     /*  if(listLocationsToMap.length>=2)
      {
        return callback({message:"break the loop on 10"});
      } */
      callback();
    });//end of localNeedle
  },function(error){
    if(error)
    {
      logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/Location/${currentIdToFetch}`,result:typeResult.failed,
      message:`${error.message}`});
    }
    callbackMain(listLocationsToMap);
  });//end of localAsync.each

}
function saveBundle2Fhir(fhirToken,fhirResource,bundle,callback){
    let localNeedle = require('needle');
    localNeedle.defaults(
    {
        open_timeout: 600000
    });
    //console.log("hapi server"+config.hapiServer);
    const url = URI(config.hapiServer.url).toString();
    let options={headers:{'Content-Type': 'application/json','Authorization':fhirToken}};
    localNeedle.post(url,JSON.stringify(bundle),options,function(err,resp){
        if(err)
        {
            logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${fhirResource}`,result:typeResult.failed,
                        message:`${err.message}`});
        }
        var response={
            status: resp.statusCode,
            message: `${bundle.entry.length} donnees synchronisees dans HAPI`,
            timestamp:new Date().getTime()
        }
        if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
			logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${fhirResource}`,result:typeResult.failed,
                        message:`Code d'erreur http: ${resp.statusCode}`});
            return callback(null);
          }
        callback(response);
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
        logger.log({level:levelType.error,operationType:typeOperation.normalProcess,action:`Enregistrement du mediateur`,result:typeResult.failed,
                        message:`Echec d'enregistrement du mediateur ${mediatorName}`});
        console.log.error(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Reception des configurations intiales",
        result:typeResult.ongoing,message:`Reception des configurations intiales`});
        config = newConfig
        if (err) {
          logger.log({level:levelType.error,operationType:typeOperation.normalProcess,action:`Echec d'obtention des configurations initiales`,result:typeResult.failed,
                        message:`Echec d'obtention des configurations initiales`});
          console.log(err.stack)
          process.exit(1)
        } else {
          logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Reception des configurations intiales",
        result:typeResult.success,message:`Enregistrement du mediateur avec succes`});
          let app = setupApp()
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              let configEmitter = medUtils.activateHeartbeat(apiConf.api)
              configEmitter.on('config', (newConfig) => {
                logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Obtension des configuratiobns a jour",
        result:typeResult.success,message:`Obtention des configurations avec succes`});
                //winston.info('Received updated config:')
                console.log(JSON.stringify(newConfig))
                // set new config for mediator
                config = newConfig

                // we can act on the new config received from the OpenHIM here
                //winston.info(config)
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
  start(() => console.log(`Listening on ${port}...`))
}

process.on('uncaughtException', err => {
  console.log(err);
  logger.log({level:levelType.error,operationType:typeOperation.stopTheService,action:`arret anormal du mediateur sur l'action `,result:typeResult.failed,
  message:`Stop the mediator on ${port}...`})
  //process.exit(1)
  globalRes.redirect("/error");
});
process.on('SIGTERM', signal => {
  logger.log({level:levelType.info,operationType:typeOperation.stopTheService,action:"Arret du mediateur",result:typeResult.success,
  message:`Arret normal du mediateur`})
  process.exit(0)
});
process.on('SIGINT', signal => {
logger.log({level:levelType.error,operationType:typeOperation.stopTheService,action:"Arret brusque du mediateur",result:typeResult.success,
message:`Arret anormal du mediateur`})
process.exit(0)
})

