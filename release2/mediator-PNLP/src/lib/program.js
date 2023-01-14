#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const URI = require('urijs');
const isJSON = require('is-json');
const path = require('path');
var btoa = require('btoa');
const moment = require('moment');
//const winston = require('winston')
const {createLogger,format,transports} = require('winston');
const { combine, timestamp, label, printf } = format;
const customLibrairy=require('./lib.js');

// Logging setup
var globalRes;
var dhisResource="organisationUnits";
var faciliyResource="facilities";
var productResource="Product";
var programResource="Program";
var fhirProgramResource="Organization";
var fhirLocationResource="Location";
var fhirProductResource="Basic";
var fhirRequisitionResource="Basic";
var dhisCategoryOption="categoryOptions";
var dhisCategory="categories";
var dhisCategoryCombo="categoryCombos";
var dhisDataElement ="dataElements";
var prodIDPrefixe="prod";
var typeOpenhimResultStatus={
  successful:"Successful",
  failed:"Failed"
}
var esigleResource={
  requitionsByFacility:'requisitions-by-facility-period'
}
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
    warning:"warn"
};

const myFormat = printf(({ level, message, label, timestamp,operationType,action,result }) => {
    return `${timestamp},${level},${label},${operationType},${action},${result},${message}`;
  });
const currentZFormatDate=moment();
// Config
var config = {} // this will vary depending on whats set in openhim-core
//const apiConf = process.env.NODE_ENV === 'test' ? require('../config/test') : require('../config/config')
var apiConfTemp=require('../config/config');
//----------- Pull env openhim config from docker envlist ----------------------------------//
/*
console.log("**************************process env ***********************");
console.log(process.cwd());
console.log("**************************process env ***********************");
*/
apiConfTemp.api.apiURL=process.env.OPENHIM_APIURL?process.env.OPENHIM_APIURL:apiConfTemp.api.apiURL;
apiConfTemp.api.username=process.env.OPENHIM_USERNAME?process.env.OPENHIM_USERNAME:apiConfTemp.api.username;
apiConfTemp.api.password=process.env.OPENHIM_PASSWORD?process.env.OPENHIM_PASSWORD:apiConfTemp.api.password;
apiConfTemp.api.trustSelfSigned=process.env.OPENHIM_TRUSTSELFSIGNED?process.env.OPENHIM_TRUSTSELFSIGNED:apiConfTemp.api.trustSelfSigned;
if(process.env.MEDIATOR_REGISTER)
{
  apiConfTemp.register=process.env.MEDIATOR_REGISTER=='false'?false:true;
}
if(process.env.MEDIATOR_HEARTBEAT)
{
  apiConfTemp.heartbeat=process.env.MEDIATOR_HEARTBEAT=='false'?false:true;
}
const apiConf=apiConfTemp;
var mediatorConfigTemp = require('../config/mediator')
/*
mediatorConfigTemp.config.dhis2Server.url=process.env.MEDIATOR_DHIS2SERVER_URL?process.env.MEDIATOR_DHIS2SERVER_URL:mediatorConfigTemp.config.dhis2Server.url;
mediatorConfigTemp.config.dhis2Server.username=process.env.MEDIATOR_DHIS2SERVER_USERNAME?process.env.MEDIATOR_DHIS2SERVER_USERNAME:mediatorConfigTemp.config.dhis2Server.username;
mediatorConfigTemp.config.dhis2Server.password=process.env.MEDIATOR_DHIS2SERVER_PASSWORD?process.env.MEDIATOR_DHIS2SERVER_PASSWORD:mediatorConfigTemp.config.dhis2Server.password;
mediatorConfigTemp.config.hapiServer.url=process.env.MEDIATOR_HAPISERVER_URL?process.env.MEDIATOR_HAPISERVER_URL:mediatorConfigTemp.config.hapiServer.url;
mediatorConfigTemp.config.hapiServer.username=process.env.MEDIATOR_HAPISERVER_USERNAME?process.env.MEDIATOR_HAPISERVER_USERNAME:mediatorConfigTemp.config.hapiServer.username;
mediatorConfigTemp.config.hapiServer.password=process.env.MEDIATOR_HAPISERVER_PASSWORD?process.env.MEDIATOR_HAPISERVER_PASSWORD:mediatorConfigTemp.config.hapiServer.password;
mediatorConfigTemp.config.esiglServer.url=process.env.MEDIATOR_ESIGLSERVER_URL?process.env.MEDIATOR_ESIGLSERVER_URL:mediatorConfigTemp.config.esiglServer.url;
mediatorConfigTemp.config.esiglServer.username=process.env.MEDIATOR_ESIGLSERVER_USERNAME?process.env.MEDIATOR_ESIGLSERVER_USERNAME:mediatorConfigTemp.config.esiglServer.username;
mediatorConfigTemp.config.esiglServer.password=process.env.MEDIATOR_ESIGLSERVER_PASSWORD?process.env.MEDIATOR_ESIGLSERVER_PASSWORD:mediatorConfigTemp.config.esiglServer.password;
mediatorConfigTemp.config.esiglServer.resourcespath=process.env.MEDIATOR_ESIGLSERVER_RESOURCES_PATH?process.env.MEDIATOR_ESIGLSERVER_RESOURCES_PATH:mediatorConfigTemp.config.esiglServer.resourcespath;
mediatorConfigTemp.config.elasticsearchServer.url=process.env.MEDIATOR_ELASTICSERVER_URL?process.env.MEDIATOR_ELASTICSERVER_URL:mediatorConfigTemp.config.elasticsearchServer.url;
mediatorConfigTemp.config.elasticsearchServer.username=process.env.MEDIATOR_ELASTICSERVER_USERNAME?process.env.MEDIATOR_ELASTICSERVER_USERNAME:mediatorConfigTemp.config.elasticsearchServer.username;
mediatorConfigTemp.config.elasticsearchServer.password=process.env.MEDIATOR_ELASTICSERVER_PASSWORD?process.env.MEDIATOR_ELASTICSERVER_PASSWORD:mediatorConfigTemp.config.elasticsearchServer.password;
mediatorConfigTemp.config.extensionBaseUrlRequisitionDetails=process.env.MEDIATOR_EXTENSIONBASEURLREQUISITIONDETAILS?process.env.MEDIATOR_EXTENSIONBASEURLREQUISITIONDETAILS:mediatorConfigTemp.config.extensionBaseUrlRequisitionDetails;
mediatorConfigTemp.config.extensionBaseUrlProgramDetails=process.env.MEDIATOR_EXTENSIONBASEURLPROGRAMDETAILS?process.env.MEDIATOR_EXTENSIONBASEURLPROGRAMDETAILS:mediatorConfigTemp.config.extensionBaseUrlProgramDetails;
mediatorConfigTemp.config.program.name=process.env.MEDIATOR_PROGRAM_NAME?process.env.MEDIATOR_PROGRAM_NAME:mediatorConfigTemp.config.program.name;
mediatorConfigTemp.config.program.code=process.env.MEDIATOR_PROGRAM_CODE?process.env.MEDIATOR_PROGRAM_CODE:mediatorConfigTemp.config.program.code;
mediatorConfigTemp.config.maxNbRequisitions2PullPerLoop=process.env.MEDIATOR_MAXREQUISITION2PULLPERPERIOD?process.env.MEDIATOR_MAXREQUISITION2PULLPERPERIOD:mediatorConfigTemp.config.maxNbRequisitions2PullPerLoop;

*/
if(process.env.MEDIATOR_URN)
{
  mediatorConfigTemp.urn=process.env.MEDIATOR_URN;
}
if(process.env.MEDIATOR_NAME)
{
  mediatorConfigTemp.name=process.env.MEDIATOR_NAME;
}
if(process.env.MEDIATOR_HOST)
{
  for (let i=0;i< mediatorConfigTemp.defaultChannelConfig.length;i++)
  {
    mediatorConfigTemp.defaultChannelConfig[i].routes[0].host=process.env.MEDIATOR_HOST;
  }
}

if(process.env.MEDIATOR_CHANNELIDENTIFIER)
{
  for (let i=0;i< mediatorConfigTemp.defaultChannelConfig.length;i++)
  {
    let startIndex=mediatorConfigTemp.defaultChannelConfig[i].name.match(/\[/);
    let endIndex= mediatorConfigTemp.defaultChannelConfig[i].name.match(/\]/);
    if(startIndex == null || endIndex==null)
    continue;
    let sliceName=mediatorConfigTemp.defaultChannelConfig[i].name.slice(startIndex.index+1,endIndex.index);
    let newChannelName=mediatorConfigTemp.defaultChannelConfig[i].name.replace(sliceName,process.env.MEDIATOR_CHANNELIDENTIFIER);
    mediatorConfigTemp.defaultChannelConfig[i].name=newChannelName;
  }
}

if( process.env.MEDIATOR_CONFIG_PROGRAMNAME)
{
  mediatorConfigTemp.config.program.name= process.env.MEDIATOR_CONFIG_PROGRAMNAME;
}
if(process.env.MEDIATOR_CONFIG_PROGRAMCODE)
{
  mediatorConfigTemp.config.program.code= process.env.MEDIATOR_CONFIG_PROGRAMCODE;
}

//console.log(mediatorConfigTemp);
const mediatorConfig = mediatorConfigTemp;
const metadataConfig=require('../config/dhismetadatadef');
//const metadataIndicatorConfig=require('../config/dhismetadataIndicatorDef');
const { ifError } = require('assert');
const { S_IFREG } = require('constants');
const { json } = require('express');
//var mediatorName="mediateur_"+mediatorConfig.config.program.name;
var mediatorName="";

//var port = process.env.NODE_ENV === 'test' ? 7001 : mediatorConfig.endpoints[0].port;
var port=process.env.MEDIATOR_PORT?process.env.MEDIATOR_PORT:mediatorConfig.endpoints[0].port;
var logger=null;
var indexSearchName=`program_activities`;
var filePath;

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

  //----------------------------Define logger information -------------------------------------/
  filePath=path.join(process.cwd(),`/data`);
  /*
  let processMonth= parseInt(config.synchronizationPeriod.split("-")[1]);
  let processYear= parseInt(config.synchronizationPeriod.split("-")[0]);
  */
  mediatorName="mediateur_"+config.program.name;
  let processMonth=currentZFormatDate.month();
  let processYear=currentZFormatDate.year();
  var indexName=`${config.program.name}_activities_${processMonth}-${processYear}`;
  var logFileName=path.join(filePath,`/logs/${indexName}.log`);
  logger = createLogger({
      format: combine(
        label({ label: mediatorName }),
        timestamp(),
        myFormat
      ),
      transports: [new transports.Console(),
          new transports.File({ filename: logFileName })
      ]
    });
	
  const app = express()
  app.use(errorHandler);
  
  //-------- routes -------------------------//
	
  app.get('/test', (req, res) => {
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    let listFacilities=[
      {
      id:1,
      identifier:[
        {
          type:{text:"dhiscode"},
          value:"code1"
        },
        {
          type:{text:"siglid"},
          value:"id1"
        }
      ],
      name:"facility1"
    },
    {
      id:2,
      identifier:[
        {
          type:{text:"dhiscode"},
          value:"code2"
        },
        {
          type:{text:"siglid"},
          value:"id2"
        }
      ],
      name:"facility1"
    },
    {
      id:3,
      identifier:[
        {
          type:{text:"dhiscode"},
          value:"code3"
        }
      ],
      name:"facility3"
    },
    {
      id:4,
      identifier:[
        {
          type:{text:"siglid"},
          value:"id4"
        }
      ],
      name:"facility4"
    }
    ];
    //let listFacilitiesMapped=listFacilities.find(mapped=>mapped.identifier.find(id=>id.value="id4"));
    let listFacilitiesMapped=[];
    for(let oFacility of listFacilities)
    {
      let find=oFacility.identifier.find(id=>id.value=="id2");
      if(find)
      {
        listFacilitiesMapped.push(oFacility);
      }
    }
    res.send(listFacilitiesMapped);

    /*
    var exec = require('child_process').exec;
    exec('ls -l ', function (error, stdout, stderr) {
      console.log(stdout);
      return res.send(stdout);
    })
    const currentPeriod = moment(config.synchronizationPeriod,'YYYY-MM');
    console.log(`--------------${config.synchronizationPeriod}------------------`);
    const startOfMonth= currentPeriod.startOf('month').format('YYYY-MM-DD');
    const endOfMonth   = currentPeriod.endOf('month').format('YYYY-MM-DD');
    console.log(`${startOfMonth} / ${endOfMonth}`);
    res.send(endOfMonth);*/
    
    /* let filterProgram=[
      {
        key:"_id",
        value:config.program.code
      }] 
      let filterProgram=[
        {
          key:"_id:in",
          value:`${listProduct.toString()}`
        }]
    
    getListHapiResourceByFilter(hapiToken,fhirProductResource,filterProgram,(programResource)=>{
      //console.log(programResource[0].resource.extension[0].extension);
      //return res.send(programResource);
      if(programResource.length>0)
      {
        //Now get list productId from resource
        let listRefencesProduct=programResource[0].resource.extension[0].extension.filter(extensionElement=>{
          if(extensionElement.url=="providedProducts")
          {
            return extensionElement;
          }
        })//end of extension.filter
        let productIdsList=[];
        for(let referenceProduct of listRefencesProduct){
          productIdsList.push(referenceProduct.valueReference.reference.split("/")[1]);
        }
        res.send(productIdsList.toString());
      }
      else{
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/getListHapiResourceByFilter`,result:typeResult.failed,
        message:`Erreur: Echec lors de l'extraction des produits par programme : ${config.program.code} `});
 
      }
    })//end getListHapiResourceByFilter(filterProgram)
    */
  });
  app.get('/loadlogs',(req, res) => {
    globalRes=res;
    
    let esToken = `Basic ${btoa(config.elasticsearchServer.username+':'+config.elasticsearchServer.password)}`;
    let url= URI(config.elasticsearchServer.url).segment(indexSearchName).segment("logs");
    url=url.toString();
    logger.log({level:levelType.info,operationType:typeOperation.startTheService,action:"/loadlogs",result:typeResult.iniate,
     message:`Lancement de de l'importation des logs dans Kibana`});
    customLibrairy.readAppLogFile(logFileName,(fileLogs)=>{
		logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/loadlogs",result:typeResult.ongoing,
     message:`${fileLogs.length} logs a inserer dans Kibana`});
      saveEntryToElastic(url,esToken,fileLogs,function(responseCollection){
        
        let successResponse=responseCollection.find(element=>element.status >=200 || element.status<300);
        //console.log(successResponse);
        let urn = mediatorConfig.urn;
        let status = '';
        let response = {};
        if(successResponse)
        {
          status = 'Successful';
          response = {
            status: 200,
            headers: {
            'content-type': 'application/json'
            },
            body:JSON.stringify( {'Process':`L'operation de chargement de logs dans Kibana effectuees avec success`}),
            timestamp: new Date().getTime()
          };
        }
        else{
          status = 'Failed';
          response = {
            status: 500,
            headers: {
            'content-type': 'application/json'
            },
            body:JSON.stringify( {'Process':`Echec de l'operation de chargement de logs dans Kibana `}),
            timestamp: new Date().getTime()
          };
        }
       var orchestrationToReturn=[
		{
		  name: "loadlogs",
		  request: {
			path :"/loadlogs",
			headers: {'Content-Type': 'application/json'},
			querystring: "",
			body:JSON.stringify( {'Process':`Operation de creation des elements des donnees dans DHIS2`}),
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
        res.status(response.status).send(returnObject);
        
      }); 
    });
  });
  app.get('/loadmediatorlog', (req, res) => {
    //var exec = require('child_process').exec;
    const { spawn } = require('child_process');
    let logstashBinPath=path.join(config.logstashDirectory,`/bin/logstash`);
    let logstashConfigFilePath=path.join(config.appDirectory,`/config/logstash_mediator.conf`);
    let args =  `${logstashBinPath} -f ${logstashConfigFilePath} `;
    //console.log(args);
    console.log("Lancement du chargement des logs");
    let child = spawn("/bin/bash "+args, []);
    child.stdout.on("data", (data) => {
      console.log(`${data}`);
    });
    /*
    exec('/bin/bash '+args, function (error, stdout, stderr) {
      console.log(stderr);
      //console.log(stdout);
      if (error !== null) 
      {
        console.log(error);
        return res.send(error);
      }
      if(true)
      {
        
        //get the PID of the current logstash process
        var execPID = require('child_process').exec;
        let cmd=`ps aux | grep -v grep |grep -i '${logstashConfigFilePath}' | awk '{print $2;}'`;
        execPID('/bin/bash '+args, function (error1, stdout1, stderr1) {
          if(error1)
          {
            console.log(error);
            return res.send(error);
          }
          if(stdout1){
            if(isNaN(stdout1)){
              console.log(`PID invalid! output: ${stdout1}`);
            }
            else{
              console.log(`PID valid. output: ${stdout1}`);
            }
            return res.send(stdout1);
          }
        })
      }
      
    });*/

  });
  app.get('/deleteresources', (req, res) => {
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    let filterExpresion=[
      {
        key:"code",
        value:"requisition"
      },
      {
        key:"subject",
        value:"Location/D1rT7FToSE4"
      },
      {
        key:"created",
        value:"2022-01-01"
      }
    ];
    console.log(`Start of deletion of hapi resources. First search the resource`);
    getListHapiResourceByFilter(hapiToken,fhirRequisitionResource,filterExpresion,(requisitionEntries)=>{
      console.log(`${requisitionEntries.length} ${fhirRequisitionResource} found`);
      //build the deletion Bundle
      let listEntriesToDelete=[];
      for(let resourceEntry of requisitionEntries ){
        var deleteEntry={
          resource:{resourceType:"Basic"},
          request: {
            method: "DELETE",
            url: `Basic/${resourceEntry.resource.id}`
            } 
        }
        listEntriesToDelete.push(deleteEntry);
      }
      var bundleDeletion={
        resourceType : "Bundle",
        type: "batch",
        entry:listEntriesToDelete
      }
      console.log(`Process of the deletion of ${bundleDeletion.entry.length} started `);
      saveBundle2Fhir(hapiToken,fhirRequisitionResource,bundleDeletion,(hapiRequisitionBundleResponse)=>{
        //console.log(`Process of the deletion of ${hapiRequisitionBundleResponse.entry.length} completed`);
        res.send(hapiRequisitionBundleResponse);
      });
      

    });

    //getListHapiResource(hapiToken,fhirRequisitionResource)
  });
  app.get('/genprogmetadata', (req, res) => {
    globalRes=res;
    var operationOutcome=true;
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/genprogmetadata",result:typeResult.iniate,
    message:`Lancement du processus de creation des elements des donnees du programme dans DHIS2`});
    let programCode=config.program.code;
    let programName=config.program.name;
    let listDatalement2Create=metadataConfig.dataElements;
    let prefixDataDict="SIGL-";
    //
    //Get catcombos id from programcode
    let filterExpression=`code:eq:${config.program.code}`;
    const dhis2Token = `Basic ${btoa(config.dhis2Server.username+':'+config.dhis2Server.password)}`;
    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/${dhisCategoryCombo}`,result:typeResult.iniate,
    message:`DHIS2: Extraction de l'ID de ${config.program.code}`});
    getListDHIS2ResourceByFilter(dhis2Token,dhisCategoryCombo,filterExpression,(resCategoryCombination)=>{
      if(resCategoryCombination && resCategoryCombination.length >0)
      {
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/${dhisCategoryCombo}`,result:typeResult.success,
        message:`DHIS2: Extraction de l'ID de ${config.program.code}`});
        operationOutcome=operationOutcome&&true;
        let listDataElementsMetadata=customLibrairy.buildDataElementMetadata(prefixDataDict,programCode,programName,listDatalement2Create,
          resCategoryCombination[0].id)
          //console.log(listDataElementsMetadata);
          //return res.send(listDataElementsMetadata);
          logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/dataElements`,result:typeResult.iniate,
          message:`DHIS2: Creation des elements des donnees du programme`});
          saveMetadataList2Dhis(dhis2Token,dhisDataElement,listDataElementsMetadata,(resOpCreationDataElement)=>{
            //console.log(resOpCreationDataElement);
            //console.log(JSON.stringify(resOpCreationDataElement[0]));
            if(resOpCreationDataElement && resOpCreationDataElement.length>0){
              let listDataElements2Update=[];
              operationOutcome=operationOutcome&&true;
              let invalidResOperation=resOpCreationDataElement.filter(element=>{
                if(element.httpStatus != "Conflict" && element.httpStatus != "Created" )
                {
                  return element;
                }
              });
              logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/dataElements`,result:typeResult.success,
              message:`DHIS2: Creation des ${listDataElementsMetadata.length - invalidResOperation.length} elements des donnees du programme`});
             
              let tempList= resOpCreationDataElement.filter(element=>{
                if(element.httpStatus == "Conflict")
                {
                  return element;
                }
              });
              for(let opResponse of tempList){
                listDataElements2Update.push(opResponse.metadata);
              } 
              if(listDataElements2Update.length>0)
              {
                logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/dataElements`,result:typeResult.iniate,
                message:`Lancement de la mise a jour des éléments des données `});
              }

              updateMetadataList2Dhis(dhis2Token,dhisDataElement,listDataElements2Update,(dhisUpdateOperation)=>{
                logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/dataElements`,result:typeResult.success,
                message:`${listDataElements2Update.length} dataElements  mise a jour`});
                let urn = mediatorConfig.urn;
                let status = '';
                let response = {};
                if(operationOutcome)
                {
                  status = 'Successful';
                  response = {
                    status: 200,
                    headers: {
                    'content-type': 'application/json'
                    },
                    body:JSON.stringify( {'Process':`L'operation de creation des elements des donnees dans DHIS2 effectuees avec success`}),
                    timestamp: new Date().getTime()
                  };
                }
                else{
                  status = 'Failed';
                  response = {
                    status: 500,
                    headers: {
                    'content-type': 'application/json'
                    },
                    body:JSON.stringify( {'Process':`Echec de creation des elements des donnees dans DHIS2`}),
                    timestamp: new Date().getTime()
                  };
                }
                var orchestrationToReturn=[
                {
                  name: "genprogmetadata",
                  request: {
                    path :"/genprogmetadata",
                    headers: {'Content-Type': 'application/json'},
                    querystring: "",
                    body:JSON.stringify( {'Process':`Operation de creation des elements des donnees dans DHIS2`}),
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
                res.status(response.status).send(returnObject);
              });//end updateMetadataList2Dhis
            }
            else{
              operationOutcome=operationOutcome&&false;
              logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/dataElements`,result:typeResult.failed,
              message:`DHIS2: Erreur lors de la creation des elements des donnees du programme`});
              logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/genprogmetadata`,result:typeResult.failed,
              message:`DHIS2: Erreur lors de la creation des elements des donnees du programme`});
              let urn = mediatorConfig.urn;
              let status = '';
              let response = {};
              if(operationOutcome)
              {
                status = 'Successful';
                response = {
                  status: 200,
                  headers: {
                  'content-type': 'application/json'
                  },
                  body:JSON.stringify( {'Process':`L'operation de creation des elements des donnees dans DHIS2 effectuees avec success`}),
                  timestamp: new Date().getTime()
                };
              }
              else{
                status = 'Failed';
                response = {
                  status: 500,
                  headers: {
                  'content-type': 'application/json'
                  },
                  body:JSON.stringify( {'Process':`Echec de creation des elements des donnees dans DHIS2`}),
                  timestamp: new Date().getTime()
                };
              }
              var orchestrationToReturn=[
              {
                name: "genprogmetadata",
                request: {
                  path :"/genprogmetadata",
                  headers: {'Content-Type': 'application/json'},
                  querystring: "",
                  body:JSON.stringify( {'Process':`Operation de creation des elements des donnees dans DHIS2`}),
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
              res.status(response.status).send(returnObject);
            }
            
          })//end saveMetadataList2Dhis(dhisDataElement)
      }
      else 
      {
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/${dhisCategoryCombo}`,result:typeResult.failed,
        message:`DHIS2: Erreur lors de l'extraction de l'ID de ${config.program.code}`});
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/genprogmetadata`,result:typeResult.failed,
        message:`DHIS2: Erreur lors de l'extraction de l'ID de ${config.program.code}`});
        let urn = mediatorConfig.urn;
        let status = 'Failed';
        let response = {
          status: 500,
          headers: {
          'content-type': 'application/json'
          },
          body:JSON.stringify( {'Process':`Echec de creation des elements des donnees dans DHIS2`}),
          timestamp: new Date().getTime()
        };
        var orchestrationToReturn=[
          {
            name: "genprogmetadata",
            request: {
              path :"/genprogmetadata",
              headers: {'Content-Type': 'application/json'},
              querystring: "",
              body:JSON.stringify( {'Process':`Operation de creation des elements des donnees dans DHIS2`}),
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
          res.status(response.status).send(returnObject);

      }
      //res.status(200).send({res:'OK'})

    });//end getListDHIS2ResourceByFilter
    


  });
  app.get('_/genprogmetadatadashboard', (req, res) => {
    globalRes=res;
    var operationOutcome=true;
    const dhis2Token = `Basic ${btoa(config.dhis2Server.username+':'+config.dhis2Server.password)}`;
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/genprogmetadata",result:typeResult.iniate,
    message:`Lancement du processus de creation des elements des donnees du programme dans DHIS2`});
    let programCode=config.program.code;
    let programName=config.program.name;
    let listDatalement2Create=metadataIndicatorConfig.dataElements;
    //
    //Get catcombos id from programcode
    
    let listDataElementsMetadata=customLibrairy.buildDataElementMetadata(programCode,programName,listDatalement2Create,
      "")
      //console.log(listDataElementsMetadata);
      //return res.send(listDataElementsMetadata);
      logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/dataElements`,result:typeResult.iniate,
      message:`DHIS2: Creation des elements des donnees du dashboard`});
      //return res.send(listDataElementsMetadata) ; 
      saveMetadataList2Dhis(dhis2Token,dhisDataElement,listDataElementsMetadata,(resOpCreationDataElement)=>{
        //console.log(resOpCreationDataElement);
        //console.log(JSON.stringify(resOpCreationDataElement[0]));
        if(resOpCreationDataElement && resOpCreationDataElement.length>0){
          let listDataElements2Update=[];
          operationOutcome=operationOutcome&&true;
          let invalidResOperation=resOpCreationDataElement.filter(element=>{
            if(element.httpStatus != "Conflict" && element.httpStatus != "Created" )
            {
              return element;
            }
          });
          logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/dataElements`,result:typeResult.success,
          message:`DHIS2: Creation des ${listDataElementsMetadata.length - invalidResOperation.length} elements des donnees du programme`});
         
          let tempList= resOpCreationDataElement.filter(element=>{
            if(element.httpStatus == "Conflict")
            {
              return element;
            }
          });
          for(let opResponse of tempList){
            listDataElements2Update.push(opResponse.metadata);
          } 
          if(listDataElements2Update.length>0)
          {
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/dataElements`,result:typeResult.iniate,
            message:`Lancement de la mise a jour des éléments des données `});
          }

          updateMetadataList2Dhis(dhis2Token,dhisDataElement,listDataElements2Update,(dhisUpdateOperation)=>{
            logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/dataElements`,result:typeResult.success,
            message:`${listDataElements2Update.length} dataElements  mise a jour`});
            let urn = mediatorConfig.urn;
            let status = '';
            let response = {};
            if(operationOutcome)
            {
              status = 'Successful';
              response = {
                status: 200,
                headers: {
                'content-type': 'application/json'
                },
                body:JSON.stringify( {'Process':`L'operation de creation des elements des donnees dans DHIS2 effectuees avec success`}),
                timestamp: new Date().getTime()
              };
            }
            else{
              status = 'Failed';
              response = {
                status: 500,
                headers: {
                'content-type': 'application/json'
                },
                body:JSON.stringify( {'Process':`Echec de creation des elements des donnees dans DHIS2`}),
                timestamp: new Date().getTime()
              };
            }
            var orchestrationToReturn=[
            {
              name: "genprogmetadata",
              request: {
                path :"/genprogmetadata",
                headers: {'Content-Type': 'application/json'},
                querystring: "",
                body:JSON.stringify( {'Process':`Operation de creation des elements des donnees dans DHIS2`}),
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
            res.status(response.status).send(returnObject);
          });//end updateMetadataList2Dhis
        }
        else{
          operationOutcome=operationOutcome&&false;
          logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/dataElements`,result:typeResult.failed,
          message:`DHIS2: Erreur lors de la creation des elements des donnees du programme`});
          logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/genprogmetadata`,result:typeResult.failed,
          message:`DHIS2: Erreur lors de la creation des elements des donnees du programme`});
          let urn = mediatorConfig.urn;
          let status = '';
          let response = {};
          if(operationOutcome)
          {
            status = 'Successful';
            response = {
              status: 200,
              headers: {
              'content-type': 'application/json'
              },
              body:JSON.stringify( {'Process':`L'operation de creation des elements des donnees dans DHIS2 effectuees avec success`}),
              timestamp: new Date().getTime()
            };
          }
          else{
            status = 'Failed';
            response = {
              status: 500,
              headers: {
              'content-type': 'application/json'
              },
              body:JSON.stringify( {'Process':`Echec de creation des elements des donnees dans DHIS2`}),
              timestamp: new Date().getTime()
            };
          }
          var orchestrationToReturn=[
          {
            name: "genprogmetadata",
            request: {
              path :"/genprogmetadata",
              headers: {'Content-Type': 'application/json'},
              querystring: "",
              body:JSON.stringify( {'Process':`Operation de creation des elements des donnees dans DHIS2`}),
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
          res.status(response.status).send(returnObject);
        }
        
      })//end saveMetadataList2Dhis(dhisDataElement)
  });

  //This endpoint is used to sync form one file
  app.get('/_syncrequisition2fhir',(req, res) => {
    globalRes=res;
    var facilityListCorrespondance=[];
    var listRequistionEntries=[];
    var operationOutcome=true;
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.iniate,
    message:`Lancement du processus de synchronisation des requisitions dans HAPI`});
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    //console.log(config);

    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${filePath}`,result:typeResult.iniate,
    message:`Extraction des requisitions pour le programme ${config.program.code}`});
    //First extract all the mapping structure and keep them in memory
    let filterExpresionAllMappedLocation=[
      {
        key:"identifier:text",
        value:"siglid"
      },
      {
        key:"_count",
        value:"10"
      }
    ];
    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/Location`,result:typeResult.iniate,
    message:`HAPI: Extraction des toutes les structures mappees `});    
    getListHapiResourceByFilter(hapiToken,fhirLocationResource,filterExpresionAllMappedLocation,(locationEntries)=>{
      if(locationEntries.length>0)
      {
        let listMappedFacilities=[];
        for(let oEntry of locationEntries)
        {
          listMappedFacilities.push(oEntry.resource);
        }
        customLibrairy.readeSIGLRequisitionCSVFile(filePath,(listAllRequisitions)=>{
          //then filter only program specific requisition
          //return res.send(listAllRequisitions);
          if(listAllRequisitions && listAllRequisitions.length>0)
          {
            operationOutcome=operationOutcome && true;
            let listProgramRequisitions=listAllRequisitions.filter(element=>{
              if(element.program_code==config.program.code)
              {
                return element;
              }
            });//end listAllRequisitions.filter
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${filePath}`,result:typeResult.success,
            message:`Fichier: ${listProgramRequisitions.length}/${listAllRequisitions.length} requisitions pour le programme ${config.program.code}`});
            //Now get the facility id and  build the RequisitionResource
            let async = require('async');
            var facilitiesListNotFound=[];
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/${fhirLocationResource}`,result:typeResult.iniate,
              message:`HAPI: Extraction des details sur les structures pour le traitement des requisitions`}); 
            async.eachSeries(listProgramRequisitions, function(reqRecord, nextRecord) {
              let facilityFound=false;
              for(let oFacility of listMappedFacilities)
              {
                let temp=oFacility.identifier.find(id=>id.type.text=="siglid" && id.value==reqRecord.facility_id);
                if(temp)
                {
                  let requisitionEntry= customLibrairy.buildRequisitionResourceEntry(reqRecord,oFacility.id,config.extensionBaseUrlRequisitionDetails,
                    config.esiglServer.url);
                  listRequistionEntries.push(requisitionEntry);
                  facilityFound=true;
                }
                else
                {
                  continue;
                }
              }
              if(!facilityFound)
              {
                if(!facilitiesListNotFound.includes(reqRecord.facility_id)){
                  facilitiesListNotFound.push(reqRecord.facility_id);
                }
                
              }
              nextRecord();
              
    
            },(err)=>{
              if(err)
              {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/${fhirLocationResource}`,
                result:typeResult.failed,message:`Extraction des details sur les structures pour le traitement des requisitions. ${err}`});
                operationOutcome= operationOutcome && false;
              }
              logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/${fhirLocationResource}`,result:typeResult.success,
              message:`${listRequistionEntries.length}/${listProgramRequisitions.length} requisitions resolues pour le programme ${config.program.code}`});
            if(facilitiesListNotFound.length >0)
            {
              //let stringList=facilitiesListNotFound.toString();
              let stringList=facilitiesListNotFound.sort().toString().split(",").join("|").substr(0,400);
              logger.log({level:levelType.warning,operationType:typeOperation.getData,action:`/fhir/${fhirLocationResource}`,result:typeResult.failed,
              message:`${stringList} structures pour les requisitions ne sont pas traitees `});
            }
            //return res.send(facilitiesListNotFound);
            //Now transform the requisition to bundle of batch type
              let bundleRequisition={
                resourceType : "Bundle",
                type: "batch",
                entry:listRequistionEntries
              };
              //return res.send(bundleRequisition);
              logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.iniate,
              message:`HAPI: Insertion des requisitions dans HAPI`});
              saveBundle2Fhir(hapiToken,fhirRequisitionResource,bundleRequisition,(hapiRequisitionBundleResponse)=>{
                if(hapiRequisitionBundleResponse.status==200)
                {
                  operationOutcome= operationOutcome && true;
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.success,
                  message:`HAPI: ${bundleRequisition.entry.length}  Insertion des requisitions dans HAPI`});
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2fhir`,result:typeResult.success,
                          message:`${hapiRequisitionBundleResponse.message}: ${bundleRequisition.entry.length} Requisition mise a jour`});
                         
                }
                else
                {
                  operationOutcome=operationOutcome && false;
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.failed,
                          message:`${hapiRequisitionBundleResponse.message}: Echec de la mise a jour des Requisitions`});
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2fhir`,result:typeResult.failed,
                          message:`${hapiRequisitionBundleResponse.message}: Echec de la mise a jour des Requisitions`});
                }
                //res.status(200).send("OK");
                let urn = mediatorConfig.urn;
                let status = '';
                let response = {};
                if(operationOutcome)
                {
                  status = 'Successful';
                  response = {
                    status: 200,
                    headers: {
                    'content-type': 'application/json'
                    },
                    body:JSON.stringify( {'Process':`L'operation de creation des requisitions dans HAPI effectuees avec success`}),
                    timestamp: new Date().getTime()
                  };
                }
                else{
                  status = 'Failed';
                  response = {
                    status: 500,
                    headers: {
                    'content-type': 'application/json'
                    },
                    body:JSON.stringify( {'Process':`Echec de creation des requisitions dans HAPI`}),
                    timestamp: new Date().getTime()
                  };
                }
                var orchestrationToReturn=[
                  {
                    name: "syncrequisition2fhir",
                    request: {
                      path :"/syncrequisition2fhir",
                      headers: {'Content-Type': 'application/json'},
                      querystring: "",
                      body:JSON.stringify( {'Process':`Operation de creation des requisitions dans HAPI`}),
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
                  res.status(response.status).send(returnObject);
    
    
              });
              //res.status(200).send(listRequistionEntries);
              
            });//end async.eachSeries(listProgramRequisitions)
            //getListHapiResourceByIdentifier(hapiToken,fhirLocationResource,)
          }
          else{
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${filePath}`,result:typeResult.failed,
          message:`Erreur lors la lecture du fichier CSV de requisitions`});
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2fhir`,result:typeResult.failed,
          message:`Erreur lors la lecture du fichier CSV de requisitions`});
          //res.status(500).send("Failed");
          let urn = mediatorConfig.urn;
          let status = 'Failed';
          let response = {
            status: 500,
            headers: {
            'content-type': 'application/json'
            },
            body:JSON.stringify( {'Process':`Echec Lors de la lecture du fichier de requisition`}),
            timestamp: new Date().getTime()
          };
          var orchestrationToReturn=[
          {
            name: "syncrequisition2fhir",
            request: {
              path :"/syncrequisition2fhir",
              headers: {'Content-Type': 'application/json'},
              querystring: "",
              body:JSON.stringify( {'Process':`Operation de creation des requisitions dans HAPI`}),
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
            res.status(response.status).send(returnObject);
          }//end else
        });//end of customLibrairy.readeSIGLRequisitionCSVFile

      }
      else
      {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/${fhirLocationResource}`,result:typeResult.failed,
          message:`Aucun mapping des structures n'a encore ete effectue`});
          logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2fhir`,result:typeResult.failed,
        message:`Aucun mapping des structures n'a encore ete effectue`});
        let responseMessage=`Aucun mapping des structures n'a encore ete effectue`;
        let bodyMessage=`Lancement du processus de synchronisation des requisitions dans HAPI`;
        let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"getListHapiResourceByFilter","GET");
        res.set('Content-Type', 'application/json+openhim');
        return res.status(returnObject.response.status).send(returnObject);

      }
    });//end of getListHapiResourceByFilter.filterExpresionAllMappedLocation
    
  });
  ////This endpoint is used to sync from the list of files
  //app.get('/syncrequisition2fhir/:regionid',(req, res) => {
    //query params should be ?regionid=xxx&periodid=xx
    app.get('/syncrequisition2fhir',(req, res) => {
    //const regionId=req.params.regionid;
    var regionId;
    if(req.query.regionid)
    {
      regionId=req.query.regionid
    }
    else
    {
      regionId=config.zoneGeographiqueId;
    }
    
    //let periodId=config.extractionPeriodId;
    let periodId;
    if(req.query.periodid)
    {
      periodId= req.query.periodid
    }
    else
    {
      periodId=config.extractionPeriodId;
    }
    
    
    console.log(`Period ID=${req.query.periodid} Region Id=${req.query.regionid}`);
    console.log(`Extracted : Period ID=${periodId} Region Id=${regionId}`);
    return res.send({});
    /*
    if (!config.zoneGeographiqueId)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
      message:`Le parametre zoneGeographiqueId est obligatoire`});
    }*/
    if(!periodId)
    {
        
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.iniate,
      message:`Le parametre periodId est obligatoire`});
        return res.send({});

    }
    if (!regionId)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.iniate,
      message:`Le parametre zoneGeographiqueId est obligatoire`});
      let responseMessage=`Erreur: Echec lors lors de la synchro des données dans DHIS2`;
      let bodyMessage=`Le variable zonegeographiqueId non defini`;
      let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"/syncrequisition2fhir","GET");
      res.set('Content-Type', 'application/json+openhim');
      return res.status(returnObject.response.status).send(returnObject);

    }
    var operationOutcome=true;
    const eSIGLToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
    
    let keyValueParmsList=[];
    keyValueParmsList.push({key:'partof',value:regionId});
    keyValueParmsList.push({key:'_sort',value:'name'});
    let fhirResource='Location';
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    let listFacilityMapped=[];
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.iniate,
    message:`Lancement du processus de synchronisation des requisitions dans HAPI pour la zone ${regionId}`});
    getListHapiResourceFilteredByParams(hapiToken,fhirResource,keyValueParmsList,function(listPrefectures)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
      message:`Niveau 1: ${listPrefectures.length} localisations retrouvés dans ${regionId}`});
      if(listPrefectures && listPrefectures.length>0)
      {
        let listPrefectureMapped=listPrefectures.filter(element =>{
          if(element.identifier.find(id=>id.type.text=="siglid")){
              return element;
              }
          });
          listFacilityMapped=listFacilityMapped.concat(listPrefectureMapped);
          logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
          message:`Niveau 1: ${listPrefectureMapped.length} structures mappés retrouvés dans ${regionId}`});
          let listkeyValueParmsList=[];
          for(let oLocation of listPrefectures)
          {
              listkeyValueParmsList.push([{key:'partof',value:oLocation.id}]);
          }
          
          getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,
            function(listSousPrefecture)
          {
            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
            message:`Niveau 2: ${listSousPrefecture.length} localisations retrouvés `});
            if(listSousPrefecture && listSousPrefecture.length>0)
            {
              
              let listSousPrefectureMapped=listSousPrefecture.filter(element =>{
                if(element.identifier.find(id=>id.type.text=="siglid")){
                    return element;
                }
              });
              listFacilityMapped=listFacilityMapped.concat(listSousPrefectureMapped);
              logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
              message:`Niveau 2: ${listSousPrefectureMapped.length} structures mappés retrouvés `});
              listkeyValueParmsList=[];
              for(let oLocation of listSousPrefecture)
              {
                  listkeyValueParmsList.push([{key:'partof',value:oLocation.id}]);
              }
              getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,
                function(listeFormationSanitaires)
            {
                logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                message:`Niveau 3: ${listeFormationSanitaires.length} localisations retrouvées `});
                if(listeFormationSanitaires && listeFormationSanitaires.length>0)
                {
                    let listFosaMapped=listeFormationSanitaires.filter(element =>{
                        if(element.identifier.find(id=>id.type.text=="siglid")){
                            return element;
                        }
                    });
                    listFacilityMapped=listFacilityMapped.concat(listFosaMapped);
                    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                    message:`Niveau 3: ${listFosaMapped.length} structures mappées à traiter`});
                    //get the list of location of the level of poste de santé and services
                    listkeyValueParmsList=[];
                    if(Boolean(config.skipNiveauPS)==false)
                    {
                      for(let oLocation of listeFormationSanitaires)
                      {
                          //console.log(oLocation);
                          listkeyValueParmsList.push([{key:'partof',value:oLocation.id}]);
                      }
                    }
                    
                    getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,
                        function(listePosteSante)
                    {
                        
                        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                        message:`Niveau 4: ${listePosteSante.length} localisations retrouvés `});
                        if(listePosteSante && listePosteSante.length>0)
                        {
                            let listPosteSanteMapped=listePosteSante.filter(element =>{
                                if(element.identifier.find(id=>id.type.text=="siglid")){
                                    return element;
                                }
                            });
                            listFacilityMapped=listFacilityMapped.concat(listPosteSanteMapped);
                        }
                        else
                        {
                            
                            logger.log({level:levelType.warning,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`Niveau 4: Aucunes structures mappées à traiter`});
                        }
                        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                        message:`Niveau 4 total: ${listFacilityMapped.length} structures mappées à traiter`});
                        //Get Requistion from facility list mapped
                        let localAsync = require('async');
                        let listAllrequisitions=[];
                        //let reducedList=listFacilityMapped.splice(0,10);
                        localAsync.eachSeries(listFacilityMapped, function(facilityMapped, callback) {
                            keyValueParmsList=[];
                            let eSIGLFacilityIdentifier=facilityMapped.identifier.find(id=>id.type.text=="siglid");
                            let dhis2FacilityId=facilityMapped.id;
                            keyValueParmsList.push({key:`facilityId`,value:eSIGLFacilityIdentifier.value});
                            keyValueParmsList.push({key:`periodId`,value:periodId});
                            keyValueParmsList.push({key:`page`,value:0});
                            keyValueParmsList.push({key:`pageSize`,value:100});
                            //config.program.code
                            getListApprovedRequisitionsByFacility3(eSIGLToken,keyValueParmsList,dhis2FacilityId,
                            //getListApprovedRequisitionsByFacility4(eSIGLToken,keyValueParmsList,dhis2FacilityId,config.program.code,
                                function(listRequisitions)
                            {
                                let filteredRequisitions=listRequisitions.filter(element=>{
                                  if(element.programCode == config.program.code)
                                  {
                                    return element;
                                  }
                                });
                                //listAllrequisitions=listAllrequisitions.concat(listRequisitions);
                                listAllrequisitions=listAllrequisitions.concat(filteredRequisitions);

                                return callback();
                            })


                        },function(error){
                            if(error)
                            {
                              logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2fhir`,result:typeResult.failed,
                              message:`Error lors de l'extraction des requisitions: ${error}`});
                            }
                            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`${listAllrequisitions.length} requisitions extraites `});
                            //Build requisition bundle item based on he structure definition
                            let listAllBundleItemRequisitions=[];
                            //filter specific requisition
                            /*let listSpecificRequisition=listAllrequisitions.filter(element=>{
                              if(element.requisitionId == 129473)
                              {
                                return element;
                              }
                            });*/
                            //
                            for(let oRequisition of listAllrequisitions)
                            //for(let oRequisition of listSpecificRequisition)
                            {
                                listAllBundleItemRequisitions.push(
                                    customLibrairy.buildRequisitionResourceWithRegionRefEntryFromESIGL(oRequisition,config.extensionBaseUrlRequisitionDetails,
                                        config.esiglServer.url,regionId)
                                )
                            }
                            operationOutcome=operationOutcome && true;
                            //callback(listAllrequisitions);
                            //res.send(listAllBundleItemRequisitions)
                            //Now transform the requisition to bundle of batch type
                            let bundleRequisition={
                              resourceType : "Bundle",
                              type: "batch",
                              entry:listAllBundleItemRequisitions
                            };
                            logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.iniate,
                            message:`HAPI: Insertion des requisitions dans HAPI`});
                            //console.log(JSON.stringify(bundleRequisition));
                            //return res.send(bundleRequisition);
                            saveBundle2Fhir(hapiToken,fhirRequisitionResource,bundleRequisition,(hapiRequisitionBundleResponse)=>{
                              if(hapiRequisitionBundleResponse.status==200)
                              {
                                operationOutcome= operationOutcome && true;
                                logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.success,
                                message:`HAPI: ${bundleRequisition.entry.length}  Insertion des requisitions dans HAPI`});
                                logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2fhir`,result:typeResult.success,
                                        message:`${hapiRequisitionBundleResponse.message}: ${bundleRequisition.entry.length} requisition mise a jour`});
                                      
                              }
                              else
                              {
                                operationOutcome=operationOutcome && false;
                                logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.failed,
                                        message:`${hapiRequisitionBundleResponse.message}: Echec de la mise a jour des Requisitions`});
                                logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2fhir`,result:typeResult.failed,
                                        message:`${hapiRequisitionBundleResponse.message}: Echec de la mise a jour des Requisitions`});
                              }
                              //res.status(200).send("OK");
                              let urn = mediatorConfig.urn;
                              let status = '';
                              let response = {};
                              if(operationOutcome)
                              {
                                status = 'Successful';
                                response = {
                                  status: 200,
                                  headers: {
                                  'content-type': 'application/json'
                                  },
                                  body:JSON.stringify( {'Process':`L'operation de creation des requisitions dans HAPI effectuees avec success`}),
                                  timestamp: new Date().getTime()
                                };
                              }
                              else{
                                status = 'Failed';
                                response = {
                                  status: 500,
                                  headers: {
                                  'content-type': 'application/json'
                                  },
                                  body:JSON.stringify( {'Process':`Echec de creation des requisitions dans HAPI`}),
                                  timestamp: new Date().getTime()
                                };
                              }
                              var orchestrationToReturn=[
                                {
                                  name: "syncrequisition2fhir",
                                  request: {
                                    path :"/syncrequisition2fhir",
                                    headers: {'Content-Type': 'application/json'},
                                    querystring: "",
                                    body:JSON.stringify( {'Process':`Operation de creation des requisitions dans HAPI`}),
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
                                res.status(response.status).send(returnObject);
                  
                  
                            });
                                          
                        })//end localAsync listFacilityMapped
                        

                    });
                }
                else
                {
                  logger.log({level:levelType.warning,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                  message:`Niveau 3: Aucunes localisations retrouvées `});
                  //Get Requistion from facility list mapped
                  let localAsync = require('async');
                  let listAllrequisitions=[];
                  logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                  message:`Niveau 3 total: ${listFacilityMapped.length} structures mappées à traiter`});
                  localAsync.eachSeries(listFacilityMapped, function(facilityMapped, callback) {
                    keyValueParmsList=[];
                    let eSIGLFacilityIdentifier=facilityMapped.identifier.find(id=>id.type.text=="siglid");
                    let dhis2FacilityId=facilityMapped.id;
                    keyValueParmsList.push({key:`facilityId`,value:eSIGLFacilityIdentifier.value});
                    keyValueParmsList.push({key:`periodId`,value:periodId});
                    keyValueParmsList.push({key:`page`,value:0});
                    keyValueParmsList.push({key:`pageSize`,value:100});
                    
                    getListApprovedRequisitionsByFacility3(eSIGLToken,keyValueParmsList,dhis2FacilityId,
                    //getListApprovedRequisitionsByFacility4(eSIGLToken,keyValueParmsList,dhis2FacilityId,config.program.code,
                        function(listRequisitions)
                    {
                        //console.log(`Returns ${listRequisitions.length} requisitons`)
                        let filteredRequisitions=listRequisitions.filter(element=>{
                          if(element.programCode == config.program.code)
                          {
                            return element;
                          }
                        });
                        //listAllrequisitions=listAllrequisitions.concat(listRequisitions);
                        listAllrequisitions=listAllrequisitions.concat(filteredRequisitions);
                        //listAllrequisitions=listAllrequisitions.concat(listRequisitions);
                        return callback();
                    })
  
                },function(error){
                    if(error)
                    {
                        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2fhir`,result:typeResult.failed,
                        message:`Error lors de l'extraction des requisitions: ${error}`});
  
                    }
                    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                    message:`${listAllrequisitions.length} requisitions extraites `});
                    //Build requisition bundle item based on he structure definition
                    let listAllBundleItemRequisitions=[];
                    for(let oRequisition of listAllrequisitions)
                    {
                        listAllBundleItemRequisitions.push(
                            customLibrairy.buildRequisitionResourceWithRegionRefEntryFromESIGL(oRequisition,config.extensionBaseUrlRequisitionDetails,
                                config.esiglServer.url,regionId)
                        )
                    }
                    //res.send(listAllBundleItemRequisitions)
                    operationOutcome=operationOutcome && true;
                    let bundleRequisition={
                      resourceType : "Bundle",
                      type: "batch",
                      entry:listAllBundleItemRequisitions
                    };
                    logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.iniate,
                    message:`HAPI: Insertion des requisitions dans HAPI`});
                    saveBundle2Fhir(hapiToken,fhirRequisitionResource,bundleRequisition,(hapiRequisitionBundleResponse)=>{
                      if(hapiRequisitionBundleResponse.status==200)
                      {
                        operationOutcome= operationOutcome && true;
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.success,
                        message:`HAPI: ${bundleRequisition.entry.length}  Insertion des requisitions dans HAPI`});
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2fhir`,result:typeResult.success,
                                message:`${hapiRequisitionBundleResponse.message}: ${bundleRequisition.entry.length} Requisition mise a jour`});
                              
                      }
                      else
                      {
                        operationOutcome=operationOutcome && false;
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.failed,
                                message:`${hapiRequisitionBundleResponse.message}: Echec de la mise a jour des Requisitions`});
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2fhir`,result:typeResult.failed,
                                message:`${hapiRequisitionBundleResponse.message}: Echec de la mise a jour des Requisitions`});
                      }
                      //res.status(200).send("OK");
                      let urn = mediatorConfig.urn;
                      let status = '';
                      let response = {};
                      if(operationOutcome)
                      {
                        status = 'Successful';
                        response = {
                          status: 200,
                          headers: {
                          'content-type': 'application/json'
                          },
                          body:JSON.stringify( {'Process':`L'operation de creation des requisitions dans HAPI effectuees avec success`}),
                          timestamp: new Date().getTime()
                        };
                      }
                      else{
                        status = 'Failed';
                        response = {
                          status: 500,
                          headers: {
                          'content-type': 'application/json'
                          },
                          body:JSON.stringify( {'Process':`Echec de creation des requisitions dans HAPI`}),
                          timestamp: new Date().getTime()
                        };
                      }
                      var orchestrationToReturn=[
                        {
                          name: "syncrequisition2fhir",
                          request: {
                            path :"/syncrequisition2fhir",
                            headers: {'Content-Type': 'application/json'},
                            querystring: "",
                            body:JSON.stringify( {'Process':`Operation de creation des requisitions dans HAPI`}),
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
                        res.status(response.status).send(returnObject);
          
          
                    });
                    
                })//end localAsync listFacilityMapped
                }
               
                //return res.send(listFacilityMapped);

            })
            }
            else
            {
              logger.log({level:levelType.warning,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
              message:`Niveau 2: Aucunes localisations retrouvées `});
              //Get Requistion from facility list mapped
              let localAsync = require('async');
              let listAllrequisitions=[];
              logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
              message:`Niveau 2 total: ${listFacilityMapped.length} structures mappées à traiter`});
              //console.log(`**** List Facilities mapped of ${listFacilityMapped.length}`)
              localAsync.eachSeries(listFacilityMapped, function(facilityMapped, callback) {
                  keyValueParmsList=[];
                  let eSIGLFacilityIdentifier=facilityMapped.identifier.find(id=>id.type.text=="siglid");
                  let dhis2FacilityId=facilityMapped.id;
                  keyValueParmsList.push({key:`facilityId`,value:eSIGLFacilityIdentifier.value});
                  keyValueParmsList.push({key:`periodId`,value:periodId});
                  keyValueParmsList.push({key:`page`,value:0});
                  keyValueParmsList.push({key:`pageSize`,value:100});
                  
                  //(eSIGLToken,keyValueParmsList,dhis2FacilityId,
                  getListApprovedRequisitionsByFacility3(eSIGLToken,keyValueParmsList,dhis2FacilityId,
                  //getListApprovedRequisitionsByFacility4(SIGLToken,keyValueParmsList,dhis2FacilityId,config.program.code,
                      function(listRequisitions)
                  {
                      //console.log(`Returns ${listRequisitions.length} requisitons`)
                      let filteredRequisitions=listRequisitions.filter(element=>{
                        if(element.programCode == config.program.code)
                        {
                          return element;
                        }
                      });
                      //listAllrequisitions=listAllrequisitions.concat(listRequisitions);
                      listAllrequisitions=listAllrequisitions.concat(filteredRequisitions);
                      //listAllrequisitions=listAllrequisitions.concat(listRequisitions);
                      return callback();
                  })

              },function(error){
                  if(error)
                  {
                      
                      logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2fhir`,result:typeResult.failed,
                      message:`Erreur lors de l'extraction des requisitions: ${error}`});

                  }
                  logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                  message:`${listAllrequisitions.length} requisitions extraites `});
                  //Build requisition bundle item based on he structure definition
                  let listAllBundleItemRequisitions=[];
                  for(let oRequisition of listAllrequisitions)
                  {
                      listAllBundleItemRequisitions.push(
                          customLibrairy.buildRequisitionResourceWithRegionRefEntryFromESIGL(oRequisition,config.extensionBaseUrlRequisitionDetails,
                              config.esiglServer.url,regionId)
                      )
                  }
                  //callback(listAllrequisitions);
                  //res.send(listAllBundleItemRequisitions)
                  operationOutcome=operationOutcome && true;
                  let bundleRequisition={
                    resourceType : "Bundle",
                    type: "batch",
                    entry:listAllBundleItemRequisitions
                  };
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.iniate,
                  message:`HAPI: Insertion des requisitions dans HAPI`});
                  saveBundle2Fhir(hapiToken,fhirRequisitionResource,bundleRequisition,(hapiRequisitionBundleResponse)=>{
                    if(hapiRequisitionBundleResponse.status==200)
                    {
                      operationOutcome= operationOutcome && true;
                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.success,
                      message:`HAPI: ${bundleRequisition.entry.length}  Insertion des requisitions dans HAPI`});
                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2fhir`,result:typeResult.success,
                              message:`${hapiRequisitionBundleResponse.message}: ${bundleRequisition.entry.length} Requisition mise a jour`});
                            
                    }
                    else
                    {
                      operationOutcome=operationOutcome && false;
                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/requisition`,result:typeResult.failed,
                              message:`${hapiRequisitionBundleResponse.message}: Echec de la mise a jour des Requisitions`});
                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2fhir`,result:typeResult.failed,
                              message:`${hapiRequisitionBundleResponse.message}: Echec de la mise a jour des Requisitions`});
                    }
                    //res.status(200).send("OK");
                    let urn = mediatorConfig.urn;
                    let status = '';
                    let response = {};
                    if(operationOutcome)
                    {
                      status = 'Successful';
                      response = {
                        status: 200,
                        headers: {
                        'content-type': 'application/json'
                        },
                        body:JSON.stringify( {'Process':`L'operation de creation des requisitions dans HAPI effectuees avec success`}),
                        timestamp: new Date().getTime()
                      };
                    }
                    else{
                      status = 'Failed';
                      response = {
                        status: 500,
                        headers: {
                        'content-type': 'application/json'
                        },
                        body:JSON.stringify( {'Process':`Echec de creation des requisitions dans HAPI`}),
                        timestamp: new Date().getTime()
                      };
                    }
                    var orchestrationToReturn=[
                      {
                        name: "syncrequisition2fhir",
                        request: {
                          path :"/syncrequisition2fhir",
                          headers: {'Content-Type': 'application/json'},
                          querystring: "",
                          body:JSON.stringify( {'Process':`Operation de creation des requisitions dans HAPI`}),
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
                      res.status(response.status).send(returnObject);
        
        
                  });
                  
              })//end localAsync listFacilityMapped

            }

          });//end of getListHapiResourceFilteredByParamsFromIteration

      }
      else
      {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2fhir`,result:typeResult.failed,
          message:`Aucune structures dans la region géographique ${regionId} n'a été retrouvés`});
      }

    });//end of getListHapiResourceFilteredByParams
    

  });
  
  //query params should be ?regionid=xxx&synchronizationperiod=yyyy-mm&codeop=x
  //codeop=1 for number of fosa who reports, 2 numbers of Pos and Neg adjustment, 
  //3 for number of fosa with SDU gt 0, and SDU eq 0
  app.get('/generatedaeValues',(req, res) => {
    //let syncPeriod=config.synchronizationPeriod;
    let syncPeriod;
    if(req.query.synchronizationperiod)
    {
      syncPeriod=req.query.synchronizationperiod;
    }
    else{
      syncPeriod= config.synchronizationPeriod;
    }
    
    if(syncPeriod.split("-").length!=2)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
      message:`Le parametre syncperiod invalid. Utilisé le format YYYY-MM`});
      return res.send({});
    }
    /*
    const regionId=config.zoneGeographiqueId;
    if (!config.zoneGeographiqueId)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
      message:`Le parametre zoneGeographiqueId est obligatoire`});
    }*/
    var regionId;
    if(req.query.regionid)
    {
      regionId=req.query.regionid
    }
    else
    {
      regionId=config.zoneGeographiqueId;
    }
    if (!regionId)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
      message:`Le parametre zoneGeographiqueId est obligatoire`});
      let responseMessage=`Erreur: Echec lors lors de la synchro des données dans DHIS2`;
      let bodyMessage=`Le variable zonegeographiqueId non defini`;
      let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"/syncrequisition2dhis","GET");
      res.set('Content-Type', 'application/json+openhim');
      return res.status(returnObject.response.status).send(returnObject);

    }
    let codeop=0;
    if(req.query.codeop)
    {
      codeop=req.query.codeop;
    }

    //let requestVar=` Request: ${regionId}-${syncPeriod}`;
    //return res.send(requestVar);
    globalRes=res;
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
    message:`Lancement du processus de synchronisation des requisitions dans DHIS2`});
    const dhis2Token = `Basic ${btoa(config.dhis2Server.username+':'+config.dhis2Server.password)}`;
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    const currentPeriod = moment(syncPeriod,'YYYY-MM');
    const startOfMonth= currentPeriod.startOf('month').format('YYYY-MM-DD');
    const endOfMonth   = currentPeriod.endOf('month').format('YYYY-MM-DD');
    let filterExpresion=[
      {
        key:"_count",
        value:config.maxNbRequisitions2PullPerLoop
        //value:"1"
      },
      {
        key:"code",
        value:"requisition"
      },
      {
        key:"created",
        value:">="+startOfMonth
      },
      {
        key:"created",
        value:"<="+endOfMonth
      },
      {
        key:"author",
        value:config.program.code
      },
      {
        key:"subject",
        value:regionId
      }

    ];
    //let filterExpression2=`?code=requisition&created=>=${startOfMonth}&created=<`
    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/requisition`,result:typeResult.iniate,
    message:`HAPI: Extraction des requisitions requisitions pour le programme ${config.program.code} pour la periode:${startOfMonth} ${endOfMonth}`});
    getListHapiResourceByFilterCurl(hapiToken,fhirRequisitionResource,filterExpresion,(requisitionEntries)=>{
      //return res.send(requisitionEntries);
      if(requisitionEntries.length>0)
      {
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/requisition`,result:typeResult.success,
        message:`HAPI: Extraction de ${requisitionEntries.length} requisitions pour le programme ${config.program.code} pour la periode:${startOfMonth} ${endOfMonth}`});
        let listFacilitiesProcessed=[];
        let listRequisitions=[];
        let listRequisitionId2Process=[];
        for(let oRequisition of requisitionEntries )
        {
          listRequisitions.push(oRequisition.resource);
          let extensionElement=oRequisition.resource.extension[0].extension.find(ext=>ext.url=="location");
          let facilityId=extensionElement.valueReference.reference.split("/")[1];
          if(!listFacilitiesProcessed.includes(facilityId))
          {
            listFacilitiesProcessed.push(facilityId);
          }
          //Extraction of the requisition id
          let reqId=oRequisition.resource.id.split("-")[0];
          if(!listRequisitionId2Process.includes(reqId))
          {
            listRequisitionId2Process.push(reqId);
          }
        }
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:`/syncrequisition2dhis`,result:typeResult.ongoing,
        message:`HAPI: Structure IDs: ${listFacilitiesProcessed.sort().toString().split(",").join("|").substr(0,400)}... `});
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:`/syncrequisition2dhis`,result:typeResult.ongoing,
        message:`HAPI: Requisition IDs: ${listRequisitionId2Process.sort().toString().split(",").join("|").substr(0,400)}... `});
        
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/requisition`,result:typeResult.success,
        message:`HAPI: Requisitions des ${listFacilitiesProcessed.length} structures a traiter  pour le programme ${config.program.code} pour la periode:${startOfMonth} ${endOfMonth}`});
        
        let filterProgram=[
          {
            key:"_id",
            value:config.program.code
          }];
        //let filterExpression2=`?code=requisition&created=>=${startOfMonth}&created=<`
        //return res.send("OK");
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/programme`,result:typeResult.iniate,
        message:`HAPI: Extraction des details du ${config.program.code} `});
    
        getListHapiResourceByFilter(hapiToken,fhirProgramResource,filterProgram,(programResource)=>{
          //console.log(programResource);
          //return res.send(programResource);
          if(programResource.length>0)
          {
            var oProgIdentifier=programResource[0].resource.identifier.find(id=>id.type.text=="dhisId");
            var progDhisId=oProgIdentifier.value;
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/programme`,result:typeResult.success,
            message:`Extraction des details du programme ${config.program.code}`});
            //Now get list productId from resource
            let listRefencesProduct=programResource[0].resource.extension[0].extension.filter(extensionElement=>{
              if(extensionElement.url=="providedProducts")
              {
                return extensionElement;
              }
            });//end of extension.filter
            let productIdsList=[];
            for(let referenceProduct of listRefencesProduct){
              productIdsList.push(referenceProduct.valueReference.reference.split("/")[1]);
            }
            let stringProductIdsList=productIdsList.toString().split(",").join("|");
            let filterProduct=[
              {
                key:"_id:in",
                value:`${productIdsList.toString()}`
              }
            ];
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/product`,result:typeResult.iniate,
            message:`HAPI: Extraction des details des produits`});
            getListHapiResourceByFilter(hapiToken,fhirProductResource,filterProduct,(productsResource)=>{
              if(productsResource.length>0)
              {
                logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/product`,result:typeResult.success,
                message:`Extraction des  details des produits [${stringProductIdsList}] pour le programme ${config.program.code}`});
                
                let listProgramProducts=[];
                for(let productResource of productsResource){
                  listProgramProducts.push(productResource.resource);
                }
                let listCustomRequisitionObjects = customLibrairy.buildObjectDetailsRequisitionList(listRequisitions,
                  listProgramProducts,progDhisId);
                //Now get facilities information to generate the Facilities hierarchie for Fosa and sousPrefecture
                let keyValueParmsListRegion=[];
                keyValueParmsListRegion.push({key:'partof',value:regionId});
                keyValueParmsListRegion.push({key:'_sort',value:'name'});
                let fhirResource='Location';
                getListHapiResourceFilteredByParams(hapiToken,fhirResource,keyValueParmsListRegion,function(listPrefectures)
                {
                  logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                  message:`Niveau 1: ${listPrefectures.length} localisations retrouvés dans ${regionId}`});
                  if(listPrefectures && listPrefectures.length>0)
                  {

                    let listkeyValueParmsList=[];
                    for(let oLocation of listPrefectures)
                    {
                        listkeyValueParmsList.push([{key:'partof',value:oLocation.id}]);
                    }
                    getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,
                      function(listSousPrefecture)
                    {
                      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                      message:`Niveau 2: ${listSousPrefecture.length} localisations retrouvés `});
                      if(listSousPrefecture && listSousPrefecture.length>0)
                      {
                        let listkeyValueParmsList=[];
                        for(let oLocation of listSousPrefecture)
                        {
                            listkeyValueParmsList.push([{key:'partof',value:oLocation.id}]);
                        }
                        getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,
                          function(listeFormationSanitaires){
                          if(listeFormationSanitaires && listeFormationSanitaires.length>0)
                          {
                            let listFosaMapped=listeFormationSanitaires.filter(element =>{
                              if(element.identifier.find(id=>id.type.text=="siglid")){
                                  return element;
                              }
                            });
                            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`Niveau 2: ${listFosaMapped.length} localisations mappées retrouvés `});
                            let listDetailFacilitiesProcessed=[];
                            for(let facilityId of listFacilitiesProcessed)
                            {
                              let foundItem=listFosaMapped.find(oFosa=>oFosa.id==facilityId);
                              if(foundItem!=null)
                              {
                                listDetailFacilitiesProcessed=listDetailFacilitiesProcessed.concat(foundItem);
                              }
                              
                            }
                            let newListDataElement2Push=[];
                            let listReportedFacilities=[];
                            //return res.send(listDetailFacilitiesProcessed);
                            //Build dataElement for Nbr of fosa Reported
                            if(codeop==1)
                            {
                              for(let oFacilityProcessed of listDetailFacilitiesProcessed)
                              {
                                //console.log(`-----------${oFacilityProcessed.id}-----------------`);
                                let fosaReported= {
                                  type:"fosaReported",
                                  idFacility:oFacilityProcessed.id,
                                  Name:oFacilityProcessed.name,
                                  dataElement:1,
                                  periodReported:startOfMonth,
                                  categoryCombo: null
                                };
                                listReportedFacilities=listReportedFacilities.concat(fosaReported);
                                
                              }
                              logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                              message:`Generation indicateurs: ${listReportedFacilities.length} Fosa reported retrouvés `});
                              newListDataElement2Push=newListDataElement2Push.concat(
                                listReportedFacilities)
                            }
                            
                            //Build new object that returns the nbre of positive adjustment by facilities
                            let listFacilitiesWithPosAdjustment=[];
                            let listFacilitiesWithNegAdjustment=[];
                            let listFacilitiesWithLosses=[];
                            let listFacilitiesWithSDUsup0=[];
                            let listFacilitiesWithSDUeq0=[];
                            let listReportedFacilitiesByProduct=[];
                            if(codeop==2)
                            {
                              for(let oFacilityProcessed of listDetailFacilitiesProcessed)
                              {
                                let listRequisitionAssociated=listCustomRequisitionObjects.filter(
                                oRequisition=>{
                                  if(oRequisition.location==oFacilityProcessed.id)
                                  {
                                  return oRequisition;
                                  }
                                })
                                let nbrePositifAdjustment=0;
                                let nbreNegativeAdjustment=0;
                                let nbreLosses=0;
                                for(let oRequisition of  listRequisitionAssociated)
                                {
                                  if(oRequisition.positiveAdjustment>0)
                                  {
                                  
                                  let fosaPosAjustement={
                                    type:"fosaPosAjustement",
                                    idFacility:oFacilityProcessed.id,
                                    Name: oFacilityProcessed.name,
                                    dataElement:1,
                                    periodReported:startOfMonth,
                                    categoryCombo:{
                                    id:config.program.code,
                                    combinationId:oRequisition.product
                                    }
                                  }
                                  listFacilitiesWithPosAdjustment=listFacilitiesWithPosAdjustment.concat(
                                    fosaPosAjustement);

                                  }
                                  if(oRequisition.negativeAdjustment>0)
                                  {
                                  let fosaNegAjustement={
                                    type:"fosaNegAjustement",
                                    idFacility:oFacilityProcessed.id,
                                    Name: oFacilityProcessed.name,
                                    dataElement:1,
                                    periodReported:startOfMonth,
                                    categoryCombo:{
                                    id:config.program.code,
                                    combinationId:oRequisition.product
                                    }
                                  }
                                  listFacilitiesWithNegAdjustment=listFacilitiesWithNegAdjustment.concat(
                                    fosaNegAjustement);
                                  } 
                                  if(oRequisition.losses>0)
                                  {
                                  let fosaLosses={
                                    type:"fosaLosses",
                                    idFacility:oFacilityProcessed.id,
                                    Name: oFacilityProcessed.name,
                                    dataElement:1,
                                    periodReported:startOfMonth,
                                    categoryCombo:{
                                    id:config.program.code,
                                    combinationId:oRequisition.product
                                    }
                                  }
                                  listFacilitiesWithLosses=listFacilitiesWithLosses.concat(
                                    fosaLosses);
                                  } 
                                }//end for oRequisition

                                
                              }//end for oFacilityProcessed
                              newListDataElement2Push=newListDataElement2Push.concat(
                                listFacilitiesWithLosses);
                              newListDataElement2Push=newListDataElement2Push.concat(
                                listFacilitiesWithNegAdjustment);
                              newListDataElement2Push=newListDataElement2Push.concat(
                                  listFacilitiesWithPosAdjustment);
                            }//End if opcode==2
                            if(codeop==3)
                            {
                              for(let oFacilityProcessed of listDetailFacilitiesProcessed)
                              {
                                let listRequisitionAssociated=listCustomRequisitionObjects.filter(
                                oRequisition=>{
                                  if(oRequisition.location==oFacilityProcessed.id)
                                  {
                                  return oRequisition;
                                  }
                                })
                                for(let oRequisition of  listRequisitionAssociated)
                                {
                                  if(oRequisition.stockOnHand>0)
                                  {
                                  let fosaSDUgt0={
                                    type:"fosaSDUgt0",
                                    idFacility:oFacilityProcessed.id,
                                    Name: oFacilityProcessed.name,
                                    dataElement:1,
                                    periodReported:startOfMonth,
                                    categoryCombo:{
                                    id:config.program.code,
                                    combinationId:oRequisition.product
                                    }
                                  }
                                  listFacilitiesWithSDUsup0=listFacilitiesWithSDUsup0.concat(fosaSDUgt0);
                                  }
                                  if(oRequisition.stockOnHand==0 && oRequisition.stockOutDay>0)
                                  {
                                  let fosaSDUeq0={
                                    type:"fosaSDUeq0",
                                    idFacility:oFacilityProcessed.id,
                                    Name: oFacilityProcessed.name,
                                    dataElement:1,
                                    periodReported:startOfMonth,
                                    categoryCombo:{
                                    id:config.program.code,
                                    combinationId:oRequisition.product
                                    }
                                  }
                                  listFacilitiesWithSDUeq0=listFacilitiesWithSDUeq0.concat(fosaSDUeq0);
                                  }
                                }//end for oRequisition
                              }//end for oFacilityProcessed
                              newListDataElement2Push=newListDataElement2Push.concat(
                                listFacilitiesWithSDUsup0);
                              newListDataElement2Push=newListDataElement2Push.concat(
                                  listFacilitiesWithSDUeq0);
                            }//End if opcode==3
                            if(codeop==4)
                            {
                              for(let oFacilityProcessed of listDetailFacilitiesProcessed)
                              {
                                let listRequisitionAssociated=listCustomRequisitionObjects.filter(
                                oRequisition=>{
                                  if(oRequisition.location==oFacilityProcessed.id)
                                  {
                                  return oRequisition;
                                  }
                                })
                                for(let oRequisition of  listRequisitionAssociated)
                                {
                                  if(oRequisition.stockOnHand>0|| (oRequisition.stockOnHand==0 && oRequisition.stockOutDay>0))
                                  {
                                  let fosaReportedByProduct={
                                    type:"fosaReportedPerProduct",
                                    idFacility:oFacilityProcessed.id,
                                    Name: oFacilityProcessed.name,
                                    dataElement:1,
                                    periodReported:startOfMonth,
                                    categoryCombo:{
                                    id:config.program.code,
                                    combinationId:oRequisition.product
                                    }
                                  }
                                  listReportedFacilitiesByProduct=listReportedFacilitiesByProduct.concat(fosaReportedByProduct);
                                  }
                                }//end for oRequisition
                              }//end for oFacilityProcessed
                              newListDataElement2Push=newListDataElement2Push.concat(
                                listReportedFacilitiesByProduct);
                            }//End if opcode==4
                            
                            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`Generation indicateurs: ${listFacilitiesWithNegAdjustment.length} negative adjustment reported retrouvés `});

                            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`Generation indicateurs: ${listFacilitiesWithLosses.length} losses reported retrouvés `});
                            
                            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`Generation indicateurs: ${listFacilitiesWithPosAdjustment.length} positive adjustment reported retrouvés `});

                            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`Generation indicateurs: ${listFacilitiesWithSDUsup0.length} SDU>0 retrouvés `});
                            
                          
                            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`Generation indicateurs: ${listFacilitiesWithSDUeq0.length} SDU=0 retrouvés `});
                            
                            logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2fhir",result:typeResult.success,
                            message:`Generation indicateurs: ${listReportedFacilitiesByProduct.length} structure ayant rapportés par produit`});
                            //return res.send(listFacilitiesWithSDUeq0);
                            /*newListDataElement2Push=newListDataElement2Push.concat(
                              listFacilitiesWithNegAdjustment);
                            newListDataElement2Push=newListDataElement2Push.concat(
                                listFacilitiesWithPosAdjustment);
                            newListDataElement2Push=newListDataElement2Push.concat(
                              listReportedFacilities);
                            newListDataElement2Push=newListDataElement2Push.concat(
                              listFacilitiesWithSDUsup0);
                            newListDataElement2Push=newListDataElement2Push.concat(
                              listFacilitiesWithSDUeq0);*/
                            //return res.send(newListDataElement2Push);
                              //Build dataElement ADX payload
                            //return res.send(newListDataElement2Push);
                            let adxDataElementObjectLists=customLibrairy.buildADXPayloadFromDataElementsList(newListDataElement2Push,
                            metadataConfig.dataElements,config.program);
                      
                            //return res.send(adxDataElementObjectLists);
                            saveAdxData2Dhis(dhis2Token,adxDataElementObjectLists,(adxSaveResults)=>{
                            if(adxSaveResults){
                            //return res.send(adxSaveResults);
                            let importChildStatus=adxSaveResults.children.find(children=>children.name=="status");
                            let importChildCount= adxSaveResults.children.find(children=>children.name=="importCount");
                            if(importChildStatus.value=="SUCCESS")
                            {
                              logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2dhis`,result:typeResult.success,
                              message:`Sommaire importation dans DHIS2. Importer: ${importChildCount.attributes.imported}| Modifier: ${importChildCount.attributes.updated}| Ignorer: ${importChildCount.attributes.ignored} `});
                            
                            let responseMessage=`Sommaire importation dans DHIS2. Importer: ${importChildCount.attributes.imported}, Modifier: ${importChildCount.attributes.updated}, Ignorer: ${importChildCount.attributes.ignored} `;
                            let bodyMessage=`Envoi des donnees des requisitions au serveur DHIS2`;
                            let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"saveAdxData2Dhis","POST");
                            res.set('Content-Type', 'application/json+openhim');
                            return res.status(returnObject.response.status).send(returnObject);
        
                            }
                            else{
                              logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/saveAdxData2Dhis`,result:typeResult.failed,
                              message:`Echec de l'importation des donnees. Code d'erreur ${importChildStatus.value}`});
                              logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2dhis`,result:typeResult.failed,
                              message:`Echec de l'importation des donnees. Code d'erreur ${importChildStatus.value}`});
                              let responseMessage=`Echec de l'importation des donnees`;
                              let bodyMessage=`Envoi des donnees des requisitions au serveur DHIS2`;
                              let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"saveAdxData2Dhis","POST");
                              res.set('Content-Type', 'application/json+openhim');
                              return res.status(returnObject.response.status).send(returnObject);
                            }
                          //return res.send(importChildCount);
                        }
                        else
                        {
                          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/api/saveAdxData2Dhis`,result:typeResult.failed,
                            message:`Aucune reponse du server DHIS2 lors de l'envoi de donnees des requisitions`});
                          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/syncrequisition2dhis`,result:typeResult.failed,
                            message:`Aucune reponse du server DHIS2 lors de l'envoi de donnees des requisitions`});
                          let responseMessage=`Attention: Aucune reponse du server DHIS2 lors de l'envoi de donnees des requisitions`;
                          let bodyMessage=`Envoi des donnees des requisitions au serveur DHIS2`;
                          let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"saveAdxData2Dhis","POST");
                          res.set('Content-Type', 'application/json+openhim');
                          return res.status(returnObject.response.status).send(returnObject);
                        }
      
                        });
                        }
                        });


                      }
                    });
                  }
                });



                
                //return res.send(adxRequisitionObjectLists);
              }
              else{
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/product`,result:typeResult.failed,
                message:`Erreur: Echec lors de l'extraction des produits [${stringProductIdsList}] par programme : ${config.program.code} `});
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2dhis`,result:typeResult.failed,
                message:`Erreur: Echec lors de l'extraction des produits [${stringProductIdsList}] par programme : ${config.program.code} `});
                
                let responseMessage=`Erreur: Echec lors de l'extraction des produits [${productIdsList.toString()}] par programme : ${config.program.code}`;
                let bodyMessage=`Extraction des produits [${productIdsList.toString()}] par programme : ${config.program.code}`;
                let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"getListHapiResourceByFilter","GET");
                res.set('Content-Type', 'application/json+openhim');
                res.status(returnObject.response.status).send(returnObject);
              }
            })//end getListHapiResourceByFilter(fhirProductResource)

          }
          else{
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/programme`,result:typeResult.failed,
            message:`Erreur: Echec lors de l'extraction  des details du programme : ${config.program.code}`});
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2dhis`,result:typeResult.failed,
            message:`Erreur: Echec lors de l'extraction  des details du programme : ${config.program.code} `});
            let responseMessage=`Erreur: Echec lors de l'extraction  des details du programme : ${config.program.code}`;
            let bodyMessage=`Extraction des details du programme : ${config.program.code}`;
            let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"getListHapiResourceByFilter","GET");
            res.set('Content-Type', 'application/json+openhim');
            return res.status(returnObject.response.status).send(returnObject);
          }
        })//end getListHapiResourceByFilter(filterProgram)
      }
      else
      {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/requisition`,result:typeResult.failed,
        message:`Erreur: Echec lors de l'extraction des requisitions pour programme : ${config.program.code} et pour la periode: ${startOfMonth}-${endOfMonth}`});
        
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2dhis`,result:typeResult.failed,
        message:`Erreur: Echec lors de l'extraction des requisitions pour programme : ${config.program.code} et pour la periode: ${startOfMonth}-${endOfMonth}`});
        let responseMessage=`Erreur: Echec lors de l'extraction des requisitions pour programme : ${config.program.code} et pour la periode: ${startOfMonth}-${endOfMonth}`;
        let bodyMessage=`Extraction des requisitions pour programme : ${config.program.code} et pour la periode: ${startOfMonth}-${endOfMonth}`;
        let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"getListHapiResourceByFilterCurl","GET");
        res.set('Content-Type', 'application/json+openhim');
        return res.status(returnObject.response.status).send(returnObject);
      }

    });//getListHapiResourceByFilterCurl(fhirRequisitionResource)
  });
  //query params should be ?regionid=xxx&synchronizationperiod=yyyy-mm
  app.get('/syncrequisition2dhis',(req, res) => {
    //let syncPeriod=config.synchronizationPeriod;
    let syncPeriod;
    if(req.query.synchronizationperiod)
    {
      syncPeriod=req.query.synchronizationperiod;
    }
    else{
      syncPeriod= config.synchronizationPeriod;
    }
    
    if(syncPeriod.split("-").length!=2)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
      message:`Le parametre syncperiod invalid. Utilisé le format YYYY-MM`});
      return res.send({});
    }
    /*
    const regionId=config.zoneGeographiqueId;
    if (!config.zoneGeographiqueId)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
      message:`Le parametre zoneGeographiqueId est obligatoire`});
    }*/
    var regionId;
    if(req.query.regionid)
    {
      regionId=req.query.regionid
    }
    else
    {
      regionId=config.zoneGeographiqueId;
    }
    if (!regionId)
    {
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
      message:`Le parametre zoneGeographiqueId est obligatoire`});
      let responseMessage=`Erreur: Echec lors lors de la synchro des données dans DHIS2`;
      let bodyMessage=`Le variable zonegeographiqueId non defini`;
      let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"/syncrequisition2dhis","GET");
      res.set('Content-Type', 'application/json+openhim');
      return res.status(returnObject.response.status).send(returnObject);

    }
    let requestVar=` Request: ${regionId}-${syncPeriod}`;
    //return res.send(requestVar);
    globalRes=res;
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncrequisition2dhis",result:typeResult.iniate,
    message:`Lancement du processus de synchronisation des requisitions dans DHIS2`});
    const dhis2Token = `Basic ${btoa(config.dhis2Server.username+':'+config.dhis2Server.password)}`;
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    const currentPeriod = moment(syncPeriod,'YYYY-MM');
    const startOfMonth= currentPeriod.startOf('month').format('YYYY-MM-DD');
    const endOfMonth   = currentPeriod.endOf('month').format('YYYY-MM-DD');
    let filterExpresion=[
      {
        key:"_count",
        value:config.maxNbRequisitions2PullPerLoop
        //value:"1"
      },
      {
        key:"code",
        value:"requisition"
      },
      {
        key:"created",
        value:">="+startOfMonth
      },
      {
        key:"created",
        value:"<="+endOfMonth
      },
      {
        key:"author",
        value:config.program.code
      },
      {
        key:"subject",
        value:regionId
      }

    ];
    //let filterExpression2=`?code=requisition&created=>=${startOfMonth}&created=<`
    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/requisition`,result:typeResult.iniate,
    message:`HAPI: Extraction des requisitions requisitions pour le programme ${config.program.code} pour la periode:${startOfMonth} ${endOfMonth}`});
    getListHapiResourceByFilterCurl(hapiToken,fhirRequisitionResource,filterExpresion,(requisitionEntries)=>{
      //return res.send(requisitionEntries);
      if(requisitionEntries.length>0)
      {
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/requisition`,result:typeResult.success,
        message:`HAPI: Extraction de ${requisitionEntries.length} requisitions pour le programme ${config.program.code} pour la periode:${startOfMonth} ${endOfMonth}`});
        let listFacilitiesProcessed=[];
        let listRequisitions=[];
        let listRequisitionId2Process=[];
        for(let oRequisition of requisitionEntries )
        {
          listRequisitions.push(oRequisition.resource);
          let extensionElement=oRequisition.resource.extension[0].extension.find(ext=>ext.url=="location");
          let facilityId=extensionElement.valueReference.reference.split("/")[1];
          if(!listFacilitiesProcessed.includes(facilityId))
          {
            listFacilitiesProcessed.push(facilityId);
          }
          //Extraction of the requisition id
          let reqId=oRequisition.resource.id.split("-")[0];
          if(!listRequisitionId2Process.includes(reqId))
          {
            listRequisitionId2Process.push(reqId);
          }
        }
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:`/syncrequisition2dhis`,result:typeResult.ongoing,
        message:`HAPI: Structure IDs: ${listFacilitiesProcessed.sort().toString().split(",").join("|").substr(0,400)}... `});
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:`/syncrequisition2dhis`,result:typeResult.ongoing,
        message:`HAPI: Requisition IDs: ${listRequisitionId2Process.sort().toString().split(",").join("|").substr(0,400)}... `});
        
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/requisition`,result:typeResult.success,
        message:`HAPI: Requisitions des ${listFacilitiesProcessed.length} structures a traiter  pour le programme ${config.program.code} pour la periode:${startOfMonth} ${endOfMonth}`});
        
        let filterProgram=[
          {
            key:"_id",
            value:config.program.code
          }];
        //let filterExpression2=`?code=requisition&created=>=${startOfMonth}&created=<`
        //return res.send("OK");
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/programme`,result:typeResult.iniate,
        message:`HAPI: Extraction des details du ${config.program.code} `});
    
        getListHapiResourceByFilter(hapiToken,fhirProgramResource,filterProgram,(programResource)=>{
          //console.log(programResource);
          //return res.send(programResource);
          if(programResource.length>0)
          {
            var oProgIdentifier=programResource[0].resource.identifier.find(id=>id.type.text=="dhisId");
            var progDhisId=oProgIdentifier.value;
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/programme`,result:typeResult.success,
            message:`Extraction des details du programme ${config.program.code}`});
            //Now get list productId from resource
            let listRefencesProduct=programResource[0].resource.extension[0].extension.filter(extensionElement=>{
              if(extensionElement.url=="providedProducts")
              {
                return extensionElement;
              }
            });//end of extension.filter
            let productIdsList=[];
            for(let referenceProduct of listRefencesProduct){
              productIdsList.push(referenceProduct.valueReference.reference.split("/")[1]);
            }
            let stringProductIdsList=productIdsList.toString().split(",").join("|");
            let filterProduct=[
              {
                key:"_id:in",
                value:`${productIdsList.toString()}`
              }
            ];
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/product`,result:typeResult.iniate,
            message:`HAPI: Extraction des details des produits`});
            getListHapiResourceByFilter(hapiToken,fhirProductResource,filterProduct,(productsResource)=>{
              if(productsResource.length>0)
              {
                logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/product`,result:typeResult.success,
                message:`Extraction des  details des produits [${stringProductIdsList}] pour le programme ${config.program.code}`});
                
                let listProgramProducts=[];
                for(let productResource of productsResource){
                  listProgramProducts.push(productResource.resource);
                }
                let listCustomRequisitionObjects = customLibrairy.buildObjectDetailsRequisitionList(listRequisitions,
                  listProgramProducts,progDhisId);
                //return res.send(listCustomRequisitionObjects);
                //listCustomRequisitionObjects=listCustomRequisitionObjects.slice(0,100);
                let adxRequisitionObjectLists=customLibrairy.buildADXPayloadFromRequisitionsList(listCustomRequisitionObjects,
                  metadataConfig.dataElements,config.program);
                  /* logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/saveAdxData2Dhis`,result:typeResult.iniate,
                  message:`Insertion des elements  de requisitions dans DHIS2`}); */
                  logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/saveAdxData2Dhis`,result:typeResult.iniate,
                  message:`Importation des ${listCustomRequisitionObjects.length} élements des requisitions dans DHIS2`});
                  console.log(`Payload size=${listCustomRequisitionObjects.length}`)
                  //return res.send(adxRequisitionObjectLists);
                  saveAdxData2Dhis(dhis2Token,adxRequisitionObjectLists,(adxSaveResults)=>{
                  if(adxSaveResults){
                    //return res.send(adxSaveResults);
                    let importChildStatus=adxSaveResults.children.find(children=>children.name=="status");
                    let importChildCount= adxSaveResults.children.find(children=>children.name=="importCount");
                    if(importChildStatus.value=="SUCCESS")
                    {
                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2dhis`,result:typeResult.success,
                      message:`Sommaire importation dans DHIS2. Importer: ${importChildCount.attributes.imported}| Modifier: ${importChildCount.attributes.updated}| Ignorer: ${importChildCount.attributes.ignored} `});
                    
                    let responseMessage=`Sommaire importation dans DHIS2. Importer: ${importChildCount.attributes.imported}, Modifier: ${importChildCount.attributes.updated}, Ignorer: ${importChildCount.attributes.ignored} `;
                    let bodyMessage=`Envoi des donnees des requisitions au serveur DHIS2`;
                    let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"saveAdxData2Dhis","POST");
                    res.set('Content-Type', 'application/json+openhim');
                    return res.status(returnObject.response.status).send(returnObject);

                    }
                    else{
                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/saveAdxData2Dhis`,result:typeResult.failed,
                      message:`Echec de l'importation des donnees. Code d'erreur ${importChildStatus.value}`});
                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/syncrequisition2dhis`,result:typeResult.failed,
                      message:`Echec de l'importation des donnees. Code d'erreur ${importChildStatus.value}`});
                      let responseMessage=`Echec de l'importation des donnees`;
                      let bodyMessage=`Envoi des donnees des requisitions au serveur DHIS2`;
                      let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"saveAdxData2Dhis","POST");
                      res.set('Content-Type', 'application/json+openhim');
                      return res.status(returnObject.response.status).send(returnObject);
                    }
                    //return res.send(importChildCount);
                  }
                  else
                  {
                    logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/api/saveAdxData2Dhis`,result:typeResult.failed,
                      message:`Aucune reponse du server DHIS2 lors de l'envoi de donnees des requisitions`});
                    logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/syncrequisition2dhis`,result:typeResult.failed,
                      message:`Aucune reponse du server DHIS2 lors de l'envoi de donnees des requisitions`});
                    let responseMessage=`Attention: Aucune reponse du server DHIS2 lors de l'envoi de donnees des requisitions`;
                    let bodyMessage=`Envoi des donnees des requisitions au serveur DHIS2`;
                    let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"saveAdxData2Dhis","POST");
                    res.set('Content-Type', 'application/json+openhim');
                    return res.status(returnObject.response.status).send(returnObject);
                  }

                });
                //return res.send(adxRequisitionObjectLists);
              }
              else{
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/product`,result:typeResult.failed,
                message:`Erreur: Echec lors de l'extraction des produits [${stringProductIdsList}] par programme : ${config.program.code} `});
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2dhis`,result:typeResult.failed,
                message:`Erreur: Echec lors de l'extraction des produits [${stringProductIdsList}] par programme : ${config.program.code} `});
                
                let responseMessage=`Erreur: Echec lors de l'extraction des produits [${productIdsList.toString()}] par programme : ${config.program.code}`;
                let bodyMessage=`Extraction des produits [${productIdsList.toString()}] par programme : ${config.program.code}`;
                let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"getListHapiResourceByFilter","GET");
                res.set('Content-Type', 'application/json+openhim');
                res.status(returnObject.response.status).send(returnObject);
              }
            })//end getListHapiResourceByFilter(fhirProductResource)

          }
          else{
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/programme`,result:typeResult.failed,
            message:`Erreur: Echec lors de l'extraction  des details du programme : ${config.program.code}`});
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2dhis`,result:typeResult.failed,
            message:`Erreur: Echec lors de l'extraction  des details du programme : ${config.program.code} `});
            let responseMessage=`Erreur: Echec lors de l'extraction  des details du programme : ${config.program.code}`;
            let bodyMessage=`Extraction des details du programme : ${config.program.code}`;
            let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"getListHapiResourceByFilter","GET");
            res.set('Content-Type', 'application/json+openhim');
            return res.status(returnObject.response.status).send(returnObject);
          }
        })//end getListHapiResourceByFilter(filterProgram)
      }
      else
      {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/requisition`,result:typeResult.failed,
        message:`Erreur: Echec lors de l'extraction des requisitions pour programme : ${config.program.code} et pour la periode: ${startOfMonth}-${endOfMonth}`});
        
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/syncrequisition2dhis`,result:typeResult.failed,
        message:`Erreur: Echec lors de l'extraction des requisitions pour programme : ${config.program.code} et pour la periode: ${startOfMonth}-${endOfMonth}`});
        let responseMessage=`Erreur: Echec lors de l'extraction des requisitions pour programme : ${config.program.code} et pour la periode: ${startOfMonth}-${endOfMonth}`;
        let bodyMessage=`Extraction des requisitions pour programme : ${config.program.code} et pour la periode: ${startOfMonth}-${endOfMonth}`;
        let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"getListHapiResourceByFilterCurl","GET");
        res.set('Content-Type', 'application/json+openhim');
        return res.status(returnObject.response.status).send(returnObject);
      }

    });//getListHapiResourceByFilterCurl(fhirRequisitionResource)
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
                callback(err);
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
            //console.log(err);
        }
        callbackMain(responseCollection);
    });//end of aysnc.each
    
}
function getListDHIS2ResourceByFilter(dhis2Token,dhisResource,filterExpression,callbackMain){
  let localNeedle = require('needle');
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  let localAsync = require('async');
  var resourceData = [];
  var url= URI(config.dhis2Server.url).segment(dhisResource+".json");
  url.addQuery('filter', filterExpression);
  url = url.toString();
  console.log(`${url}`);
  localAsync.whilst(
      callback => {
          return callback(null, url !== false);
        },
      callback => {
          
          var options={headers:{'Authorization':dhis2Token}};
          localNeedle.get(url,options, function(err, resp) {
              //url = false;
              if (err) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`${err.message}`});
                return callback(true, false);
              }
              if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Code d'erreur http: ${resp.statusCode}`});
                  return callback(true, false);
              }
              var body = resp.body;
              //var body = JSON.parse(resp.body);
              console.log(body[dhisResource]);
              if (!body[dhisResource]) {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Invalid ${dhisResource} retournees par DHIS2`});
                  return callback(true, false);
              }
              if (body.pager.total === 0) {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Pas de ressources retournees par DHIS2 - page: ${body.pager.page}`});
                  return callback(true, false);
              }
              url = false;
              if (body[dhisResource] && body[dhisResource].length > 0) {
        /* logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${dhisResource} => page:${body.pager.page}/${body.pager.pageCount}`,
        result:typeResult.success,message:`Extraction de  ${body[dhisResource].length} ${dhisResource} de DHIS2`}); */
                  resourceData = resourceData.concat(body[dhisResource]);
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
function saveMetadataList2Dhis(dhis2Token,dhisResource,listMetadata,callback){
  let localNeedle = require('needle');
  let localAsync = require('async');
  let dicOperationResults=[];
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  var url= URI(config.dhis2Server.url).segment(dhisResource);
  url = url.toString();
  let options={headers:{'Content-Type': 'application/json','Authorization':dhis2Token}};
  localAsync.eachSeries(listMetadata, function(metadata, nextResource) {
    localNeedle.post(url,JSON.stringify(metadata),options,function(err,resp){
      //console.log(resp.body);
      if(err)
      {
          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                      message:`${err.Error}`});
          nextResource(err);
      }
      dicOperationResults.push({
        httpStatus:resp.body.httpStatus,
        metadata:metadata
      });
      if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
        if(resp.statusCode==409)
        {
          logger.log({level:levelType.warning,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                          message:`Code: ${resp.statusCode}. Impossible de creer une ressource qui existe deja`});
        }
        else{
          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                          message:`Code d'erreur http: ${resp.statusCode}`});
        }
      }
      nextResource();
      
    });//end localNeedle
  },(err)=>{
    if(err)
    {
      /* logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
      message:`${err.message}`}); */
    }
    callback(dicOperationResults);
    
  });//end localAsync
  

}
function getListHapiResourceByIdentifier(hapiToken,fhirResource,identifierValue,callbackMain)
{
  let localNeedle = require('needle');
  var listResourcesNotResolved=[];
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
    let localAsync = require('async');
    var resourceData = [];
    var url= URI(config.hapiServer.url).segment(fhirResource);
    url.addQuery('identifier', identifierValue);
    url.addQuery('_format', "json");
    url = url.toString();
    localAsync.whilst(
      callback => {
          return callback(null, url !== false);
        },
      callback => {
          
          localNeedle.get(url,options, function(err, resp) {
              //url = false;
              if (err) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                              message:`${err}`});
                return callback(err);
              }
              if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
                console.log("----------here 1-----------------");
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Code d'erreur http: ${resp.statusCode}`});
                  return callback(true, false);
              }
              let body = JSON.parse(resp.body);
              if (!body.entry) {
                /* logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Ressource invalide [${identifierValue}] retourner par le serveur FHIR`}); */
                
                return callback(true, false);
              }
              if (body.total === 0 && body.entry && body.entry.length > 0) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`});
                return callback(true, false);
              }
              url = false;
              if (body.entry && body.entry.length > 0) {
                  resourceData = resourceData.concat(body.entry);
                  //force return only one loop data
                  //return callback(true, false);
              }
              const next =  body.link && body.link.find(link => link.relation === 'next');

              if(next)
              {
                  url = next.url;;
              }
              return callback(null, url);
          })//end of needle.get
            
      },//end callback 2
      err=>{

        /* if(listResourcesNotResolved.length>0)
        {
          let stringIvalidResource=listResourcesNotResolved.sort().toString().split(",").join("|").substr(0,400);
          logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/fhir/${fhirResource}`,result:typeResult.failed,
          message:`Ressources invalides: ${stringIvalidResource}... retourner par le serveur FHIR`})
        } */
          return callbackMain(resourceData);

      }
  );//end of async.whilst



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
          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
          message:`${err.Error}`});
          return callback({
            status: 500,
            message: `${err.Error}`,
            timestamp:new Date().getTime()
          });
      }
      var response={
          status: resp.statusCode,
          message: `${bundle.entry.length} ${fhirResource} synchronisees dans HAPI`,
          timestamp:new Date().getTime()
      }
      
      if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
    logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                      message:`Code d'erreur http: ${resp.statusCode}`});
          return callback(null);
        }
      callback(response);
  });

}
function getListHapiResourceByFilter(hapiToken,fhirResource,filterExpressionDic,callbackMain)
{
  //to comment
  //return callbackMain([{id:1},{id:2}]);
  let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
    let localAsync = require('async');
    var resourceData = [];
    var url= URI(config.hapiServer.url).segment(fhirResource);
    url.addQuery('_format', "json");
    for(let dic of filterExpressionDic)
    {
      url.addQuery(dic.key, dic.value);
    }
    let currentNbreOfResource=0;
    url = url.toString();
    //console.log(`Url: ${url}`);
    localAsync.whilst(
      callback => {
          return callback(null, url !== false);
        },
      callback => {
          
          localNeedle.get(url,options, function(err, resp) {
              ////url = false;
              if (err) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`${err.message}`});
                return callback(true, false);
              }
              if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                              message:`Code d'erreur http: ${resp.statusCode}`});
                  return callback(true, false);
              }
              let body = JSON.parse(resp.body);
              if (!body.entry) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`});
                return callback(true, false);
              }
              if (body.total === 0 && body.entry && body.entry.length > 0) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`});
                return callback(true, false);
              }
              url=false;
              if (body.entry && body.entry.length > 0) {
                currentNbreOfResource+=body.entry.length;
                /* logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${fhirResource} page:${currentNbreOfResource}`,
                result:typeResult.success,message:`Extraction de  ${body.entry.length} ${fhirResource} de HAPI`}); */
                  resourceData = resourceData.concat(body.entry);
              }
              const next =  body.link && body.link.find(link => link.relation === 'next');

              if(next)
              {
                  url = next.url;;
              }
              return callback(null, url);
          })//end of needle.get
            
      },//end callback 2
      err=>{
          return callbackMain(resourceData);

      }
  );//end of async.whilst



}
function getListHapiResourceFilteredByParams(hapiToken,fhirResource,keyValueParmsList,callbackMain)
{
  let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
    let localAsync = require('async');
    var resourceData = [];
    var url= URI(config.hapiServer.url).segment(fhirResource);
    //build the params query
    for(let oDic of keyValueParmsList)
    {
      url.addQuery(`${oDic.key}`,`${oDic.value}`);
    }
    url.addQuery('_format', "json");
    url = url.toString();
    console.log(`${url}`);
    localAsync.whilst(
      callback => {
          return callback(null, url !== false);
        },
      callback => {
          
          localNeedle.get(url,options, function(err, resp) {
              
              if (err) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`${err.Error}`});
                return callback(true, false);
              }
              if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
              logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Code d'erreur http: ${resp.statusCode}`});
                  return callback(true, false);
              }
              let body = JSON.parse(resp.body);
              if (!body.entry) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`});
                return callback(true, false);
              }
              if (body.total === 0 && body.entry && body.entry.length > 0) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`});
                return callback(true, false);
              }
              url = false;
              if (body.entry && body.entry.length > 0) {
                for(let oEntry of body.entry)
                {
                    resourceData.push(oEntry.resource);
                }
              }
              const next =  body.link && body.link.find(link => link.relation === 'next');

              if(next)
              {
                  url = next.url;
                  console.log(`Hapi loop ${url}`)
              }
              return callback(null, url);
          })//end of needle.get
            
      },//end callback 2
      err=>{
          return callbackMain(resourceData);

      }
  );//end of async.whilst



}
function getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,callbackMain)
{
    let localAsync = require('async');
    var listResourcesFound = [];
    localAsync.eachSeries(listkeyValueParmsList, function(keyValueParmsList, callback) {
        getListHapiResourceFilteredByParams(hapiToken,fhirResource,keyValueParmsList,function (listResources){
            console.log(`Children founded ${listResources.length}`)
            listResourcesFound=listResourcesFound.concat(listResources);
            return callback();
        })
        //return callback();
    },function(error){
        if(error)
        {
            console.log (`Error ${error}`)
        }
        return callbackMain(listResourcesFound);
    });
}
function getListHapiResourceByFilterCurl(hapiToken,fhirResource,filterExpressionDic,callbackMain)
{
  var exec = require('child_process').exec;
    let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
    let localAsync = require('async');
    var resourceData = [];
    var url= URI(config.hapiServer.url).segment(fhirResource);
    url.addQuery('_format', "json");
    for(let dic of filterExpressionDic)
    {
      url.addQuery(dic.key, dic.value);
    }
    let currentNbreOfResource=0;
    url = url.toString();
    let args="";

    console.log(`Url: ${url}`);
    localAsync.whilst(
      callback => {
          return callback(null, url !== false);
        },
      callback => {
        
        //console.log(`Url=> ${url}`);
        args = `-X GET  -H 'Content-Type: application/fhir+json' '${url}' `;
        
        exec('curl ' + args, function (error, stdout, stderr) {
          url = false;
          if (error !== null) {
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${fhirResource}`,result:typeResult.failed,
                      message:`${error}`});
            return callback(true, false);
          }
          let body=JSON.parse(stdout);
          if (!body.entry) {
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${fhirResource}`,result:typeResult.failed,
                  message:`Ressource invalid retourner par le serveur FHIR`});
            return callback(true, false);
          }
          if (body.entry && body.entry.length > 0) {
            currentNbreOfResource+=body.entry.length;
            /* logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${fhirResource} page:${currentNbreOfResource}`,
                result:typeResult.success,message:`Extraction de  ${body.entry.length} ${fhirResource} de HAPI`}); */
            resourceData = resourceData.concat(body.entry);
          }
          const next =  body.link && body.link.find(link => link.relation === 'next');
          //console.log(next);
          if(next)
          {
              url = next.url;;
          }
          //console.log(`url: ${url}`);
          //force breack on requisition for the first loop
          /*
          if(fhirResource==fhirRequisitionResource  )
          {
             return callback(true, false);
          } 
          */
          return callback(null, url);
          //return callback(true, false);

        });//end exec
            
      },//end callback 2
      err=>{
          return callbackMain(resourceData);

      }
  );//end of async.whilst



}
function getListHapiResource(hapiToken,fhirResource,callbackMain)
{
  let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
    let localAsync = require('async');
    var resourceData = [];
    var url= URI(config.hapiServer.url).segment(fhirResource);
    url.addQuery('_format', "json");
    url = url.toString();
    localAsync.whilst(
      callback => {
          return callback(null, url !== false);
        },
      callback => {
          
          localNeedle.get(url,options, function(err, resp) {
              url = false;
              if (err) {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${fhirResource}`,result:typeResult.failed,
                      message:`${err.message}`});
              }
              if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${fhirResource}`,result:typeResult.failed,
                      message:`Code d'erreur http: ${resp.statusCode}`});
                  return callback(true, false);
              }
              let body = JSON.parse(resp.body);
              if (!body.entry) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${fhirResource}`,result:typeResult.failed,
                      message:`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`});
                return callback(true, false);
              }
              if (body.total === 0 && body.entry && body.entry.length > 0) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${fhirResource}`,result:typeResult.failed,
                message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`});
                return callback(true, false);
              }
              if (body.entry && body.entry.length > 0) {
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${fhirResource} page:${body.entry.length}/${body.total}`,
        result:typeResult.success,message:`Extraction de  ${body.entry.length} ${fhirResource} de HAPI`});
                  resourceData = resourceData.concat(body.entry);
                  //force return only one loop data
                  //return callback(true, false);
              }
              const next =  body.link && body.link.find(link => link.relation === 'next');

              if(next)
              {
                  url = next.url;;
              }
              return callback(null, url);
          })//end of needle.get
            
      },//end callback 2
      err=>{
          return callbackMain(resourceData);

      }
  );//end of async.whilst



}
function getListApprovedRequisitionsByFacility3(eSIGLToken,keyValueParmsList,dhis2FacilityId,callbackMain)
  {
    let localNeedle = require('needle');
      localNeedle.defaults(
          {
              open_timeout: 600000
          });
      let options={headers:{'Content-Type': 'application/json','Authorization':eSIGLToken}};
      let localAsync = require('async');
      var resourceData = [];
      var url= URI(config.esiglServer.url).segment(config.esiglServer.resourcespath).segment(esigleResource.requitionsByFacility);
      //build the params query
      let initFacilityId="";
      for(let oDic of keyValueParmsList)
      {
        url.addQuery(`${oDic.key}`,`${oDic.value}`);
        if(oDic.key=="facilityId")
        {
            initFacilityId=oDic.value;
        }
      }
      url.addQuery('_format', "json");
      url = url.toString();
      console.log(`${url}`);
      localAsync.whilst(
        callback => {
            return callback(null, url !== false);
          },
        callback => {
            
            localNeedle.get(url,options, function(err, resp) {
                let initUrl=url;
                if (err) {
                  logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`${err.err.Error}`});
                  return callback(true, false);
                }
                if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Code d'erreur http: ${resp.statusCode}`});
                    return callback(true, false);
                }
                let body=resp.body;
                if (!body.data) {
                  logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`});
                  return callback(true, false);
                }
                if (body.data.totalRecords === 0 && body.data.rows.length > 0) {
                  logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                  message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`})
                  return callback(true, false);
                }
                url = false;
                if (body.data && body.data.rows.length > 0) {
                    resourceData = resourceData.concat(body.data.rows);
                    //console.log(`${resourceData.length} requisitions retreived /${body.data.totalRecords} expected`)
                    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${initUrl}`,result:typeResult.success,
                    message:`${resourceData.length} requisitions retreived /${body.data.totalRecords} expected`})
                  
                   
                }
                const next =  resourceData.length < body.data.totalRecords?true:false;
  
                if(next)
                {
                    let urlSplitComponents=initUrl.split("&");
                    let rebuiltUrl="";
                    let indexLoop=0;
                    for(let urlcomponent of urlSplitComponents)
                    {
                        
                        if(urlcomponent.includes("page="))
                        {
                            //get and change the page index
                            let index=parseInt( urlcomponent.split("=")[1]);
                            index++;
                            rebuiltUrl+=`&page=${index}`;
                            
                        }
                        else{
                            if(indexLoop==0)
                            {
                                rebuiltUrl+=urlcomponent;
                            }
                            else
                            {
                                rebuiltUrl+=`&${urlcomponent}`;
                            }
                        }
                        indexLoop++
                    }
                    url = rebuiltUrl;
                    console.log(`eSIGL next loop ${url}`)
                }
                return callback(null, url);
            })//end of needle.get
              
        },//end callback 2
        err=>{
            
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/getListApprovedRequisitionsByFacility3`,result:typeResult.success,
                    message:`Total ${resourceData.length} Requisitions fetch completed for facility ${initFacilityId}`})
            let listApprovedRequisitionTemp=resourceData.filter(element =>{
                if(element.requisitionStatus=="APPROVED" && element.programCode==config.program.code)
                {
                    return element;
                }
            })
            let listApprovedRequisition=[];
            for(let requisition of listApprovedRequisitionTemp)
            {
              let requisitionWithDhisId=requisition;
              requisitionWithDhisId.facilityId=dhis2FacilityId;
              listApprovedRequisition.push(requisitionWithDhisId);
            }
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/getListApprovedRequisitionsByFacility3`,result:typeResult.success,
                  message:`${config.program.code}: ${listApprovedRequisition.length} approuved requisitions/${resourceData.length} total`})
            return callbackMain(listApprovedRequisition);
  
        }
    );//end of async.whilst
  
  
  
  }
//This function exclude filter requisition by programCode to avoid to pull accidentaly requisition from other program
//This usualy happen when the mediator is copied to create a new one
function getListApprovedRequisitionsByFacility4(eSIGLToken,keyValueParmsList,dhis2FacilityId,programCode,callbackMain)
  {
    let localNeedle = require('needle');
      localNeedle.defaults(
          {
              open_timeout: 600000
          });
      let options={headers:{'Content-Type': 'application/json','Authorization':eSIGLToken}};
      let localAsync = require('async');
      var resourceData = [];
      var url= URI(config.esiglServer.url).segment(config.esiglServer.resourcespath).segment(esigleResource.requitionsByFacility);
      //build the params query
      let initFacilityId="";
      for(let oDic of keyValueParmsList)
      {
        url.addQuery(`${oDic.key}`,`${oDic.value}`);
        if(oDic.key=="facilityId")
        {
            initFacilityId=oDic.value;
        }
      }
      url.addQuery('_format', "json");
      url = url.toString();
      console.log(`${url}`);
      localAsync.whilst(
        callback => {
            return callback(null, url !== false);
          },
        callback => {
            
            localNeedle.get(url,options, function(err, resp) {
                let initUrl=url;
                if (err) {
                  logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`${err.err.Error}`});
                  return callback(true, false);
                }
                if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Code d'erreur http: ${resp.statusCode}`});
                    return callback(true, false);
                }
                let body=resp.body;
                if (!body.data) {
                  logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`});
                  return callback(true, false);
                }
                if (body.data.totalRecords === 0 && body.data.rows.length > 0) {
                  logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                  message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`})
                  return callback(true, false);
                }
                url = false;
                if (body.data && body.data.rows.length > 0) {
                    let filteredElement=body.data.rows.filter(element=>{
                      if(element.programCode == programCode)
                      {
                        return element;
                      }
                    });
                    resourceData = resourceData.concat(filteredElement);

                    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${initUrl}`,result:typeResult.success,
                      message:`${filteredElement.length} requisitions retreived /${body.data.totalRecords} total returned`});
                    
                }
                const next =  resourceData.length < body.data.totalRecords?true:false;
  
                if(next)
                {
                    let urlSplitComponents=initUrl.split("&");
                    let rebuiltUrl="";
                    let indexLoop=0;
                    for(let urlcomponent of urlSplitComponents)
                    {
                        
                        if(urlcomponent.includes("page="))
                        {
                            //get and change the page index
                            let index=parseInt( urlcomponent.split("=")[1]);
                            index++;
                            rebuiltUrl+=`&page=${index}`;
                            
                        }
                        else{
                            if(indexLoop==0)
                            {
                                rebuiltUrl+=urlcomponent;
                            }
                            else
                            {
                                rebuiltUrl+=`&${urlcomponent}`;
                            }
                        }
                        indexLoop++
                    }
                    url = rebuiltUrl;
                    console.log(`eSIGL next loop ${url}`)
                }
                return callback(null, url);
            })//end of needle.get
              
        },//end callback 2
        err=>{
            
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/getListApprovedRequisitionsByFacility3`,result:typeResult.success,
                    message:`Total ${resourceData.length} Requisitions fetch completed for facility ${initFacilityId}`})
            let listApprovedRequisitionTemp=resourceData.filter(element =>{
                if(element.requisitionStatus=="APPROVED" && element.programCode==config.program.code)
                {
                    return element;
                }
            })
            let listApprovedRequisition=[];
            for(let requisition of listApprovedRequisitionTemp)
            {
              let requisitionWithDhisId=requisition;
              requisitionWithDhisId.facilityId=dhis2FacilityId;
              listApprovedRequisition.push(requisitionWithDhisId);
            }
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/getListApprovedRequisitionsByFacility3`,result:typeResult.success,
                  message:`${config.program.code}: ${listApprovedRequisition.length} approuved requisitions/${resourceData.length} total`})
            return callbackMain(listApprovedRequisition);
  
        }
    );//end of async.whilst
  
  
  
  }
function saveAdxData2Dhis(dhis2Token,adxPayload,callback){
  let localNeedle = require('needle');
  var parseString = require('xml2js').parseString;
  let dicOperationResults=[];
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  var url= URI(config.dhis2Server.url).segment("dataValueSets");
  url.addQuery("dataElementIdScheme","UID");
  url.addQuery("orgUnitIdScheme","UID");
  url = url.toString();
  let options={headers:{'Content-Type': 'application/adx+xml','Authorization':dhis2Token}};
  localNeedle.post(url,adxPayload,options,function(err,resp){
    if(err)
    {
        logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/dataValueSets`,result:typeResult.failed,
                    message:`${err.Error}`});
        callback({});
    }
    callback(resp.body);
    
  });//end localNeedle
  

}
function updateMetadataList2Dhis(dhis2Token,dhisResource,listMetadata,callback){
  let localNeedle = require('needle');
  let localAsync = require('async');
  let dicOperationResults=[];
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  
  //url = url.toString();
  let options={headers:{'Content-Type': 'application/json','Authorization':dhis2Token}};
  localAsync.eachSeries(listMetadata, function(metadata, nextResource) {
    let url= URI(config.dhis2Server.url).segment(dhisResource).segment(metadata.id);
    url=url.toString();
    localNeedle.put(url,JSON.stringify(metadata),options,function(err,resp){
      if(err)
      {
          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${dhisResource}`,result:typeResult.failed,
                      message:`${err.Error}`});
          nextResource(err);
          
      }
      dicOperationResults.push({
        httpStatus:resp.body.httpStatus,
        metadata:metadata
      });
      if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
        logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${dhisResource}`,result:typeResult.failed,
                          message:`Code d'erreur http: ${resp.statusCode}`});
      }
      nextResource();
      
    });//end localNeedle
  },(err)=>{
    if(err)
    {
      /* logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${dhisResource}`,result:typeResult.failed,
      message:`${err.message}`}); */
    }
    callback(dicOperationResults);
    
  });//end localAsync
  

}

function  getOpenhimResult(responseMessage, bodyMessage,statusValue,orchestrationName,HttpMethod)
{
  let urn = mediatorConfig.urn;
  let status = null;
  let response = null;
  if(statusValue==typeOpenhimResultStatus.successful)
  {
    status = 'Successful';
    response = {
    status: 200,
      headers: {
      'content-type': 'application/json'
      },
      body:JSON.stringify( {'Process':`${responseMessage}`}),
      timestamp: new Date().getTime()
    };
  }
  else
  {
    status = 'Failed';
    response = {
    status: 500,
      headers: {
      'content-type': 'application/json'
      },
      body:JSON.stringify( {'Process':`${responseMessage}`}),
      timestamp: new Date().getTime()
    };
  }
  var orchestrationToReturn=[
  {
    name: orchestrationName,
    request: {
      path :`/${orchestrationName}`,
      headers: {'Content-Type': 'application/json'},
      querystring: "",
      body:JSON.stringify( {'Process':`${bodyMessage}`}),
      method: HttpMethod,
      timestamp: new Date().getTime()
    },
    response: response
  }];
  var openhimObject = {
    "x-mediator-urn": urn,
    "status": status,
    "response": response,
    "orchestrations": orchestrationToReturn,
    "properties": ""
  }
  return openhimObject;
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  //var filePath=mediatorConfig.config.appDirectory;
  filePath=path.join(process.cwd(),`/data`);
  let processMonth= parseInt(mediatorConfig.config.synchronizationPeriod.split("-")[1]);
  let processYear= parseInt(mediatorConfig.config.synchronizationPeriod.split("-")[0]);
  var indexName=`${mediatorConfig.config.program.name}_activities_${processMonth}-${processYear}`;
  var logFileName=path.join(filePath,`/logs/${indexName}.log`);
  logger = createLogger({
      format: combine(
        label({ label: mediatorName }),
        timestamp(),
        myFormat
      ),
      transports: [new transports.Console(),
          new transports.File({ filename: logFileName })
      ]
    });

  if (apiConf.api.trustSelfSigned) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        logger.log({level:levelType.error,operationType:typeOperation.normalProcess,action:`Enregistrement du mediateur`,result:typeResult.failed,
                        message:`Echec d'enregistrement du mediateur ${mediatorName}`}); 
        //console.log(`Echec d'enregistrement du mediateur ${mediatorName}`);
        console.log(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Reception des configurations intiales",
        result:typeResult.ongoing,message:`Reception des configurations intiales`}); 
        //console.log(`Reception des configurations intiales`);
        config = newConfig;
        //update the loger to take the new mediator name
        mediatorName="mediateur_"+config.program.name;
        indexName=`${mediatorName}_activities_${processMonth}-${processYear}`;
        logFileName=path.join(filePath,`/logs/${indexName}.log`);
        logger = createLogger({
          format: combine(
            label({ label: mediatorName }),
            timestamp(),
            myFormat
          ),
          transports: [new transports.Console(),
              new transports.File({ filename: logFileName })
          ]
        });
        if (err) {
          logger.log({level:levelType.error,operationType:typeOperation.normalProcess,action:`Echec d'obtention des configurations initiales`,result:typeResult.failed,
                        message:`Echec d'obtention des configurations initiales`}); 
          //console.log(`Echec d'obtention des configurations initiales`);
          console.log(err.stack)
          process.exit(1)
        } else {
          logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Reception des configurations intiales",
        result:typeResult.success,message:`Enregistrement du mediateur avec succes`}); 
        //console.log(`Enregistrement du mediateur avec succes`);
          let app = setupApp()
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              let configEmitter = medUtils.activateHeartbeat(apiConf.api)
              configEmitter.on('config', (newConfig) => {
                logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Obtension des configuratiobns a jour",
        result:typeResult.success,message:`Obtention des configurations avec succes`}); 
                //console.log(`Obtention des configurations avec succes`);
                //winston.info('Received updated config:')
                console.log(JSON.stringify(newConfig))
                // set new config for mediator
                config = newConfig
                mediatorName="mediateur_"+config.program.name;
                indexName=`${mediatorName}_activities_${processMonth}-${processYear}`;
                logFileName=path.join(filePath,`/logs/${indexName}.log`);
                logger = createLogger({
                  format: combine(
                    label({ label: mediatorName }),
                    timestamp(),
                    myFormat
                  ),
                  transports: [new transports.Console(),
                      new transports.File({ filename: logFileName })
                  ]
                });

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

