#!/usr/bin/env node
'use strict'

var express = require('express')
const URI = require('urijs');
const isJSON = require('is-json');
const path = require('path')
var btoa = require('btoa');
const moment = require('moment');
var app = express();
app.listen(8001);
var config=require('./config');

let esigleResource={
    requitionsByFacility:'requisitions-by-facility-period'
}
app.get('/listFacilities/:regionid', function(req, res) {
    const regionId=req.params.regionid;
    if(!req.query.periodid)
    {
        console.log(`Le parametre periodId est obligatoire`);
        return res.send({});

    }
    const eSIGLToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
    let periodId=req.query.periodid;
    let keyValueParmsList=[];
    keyValueParmsList.push({key:'partof',value:regionId});
    keyValueParmsList.push({key:'_sort',value:'name'});
    let fhirResource='Location';
    const hapiToken = `Basic ${btoa('admin'+':'+'admin')}`;
    let listFacilityMapped=[];
    getListHapiResourceFilteredByParams(hapiToken,fhirResource,keyValueParmsList,function(listPrefectures)
    {
        //res.send(listResources);
        //for each district get the list of facilities
        if(listPrefectures && listPrefectures.length>0)
        {
            let listPrefectureMapped=listPrefectures.filter(element =>{
                if(element.identifier.find(id=>id.type.text=="siglid")){
                    return element;
                }
            });
            listFacilityMapped=listFacilityMapped.concat(listPrefectureMapped);
            let listkeyValueParmsList=[];
            for(let oLocation of listPrefectures)
            {
                
                //console.log(oLocation);
                listkeyValueParmsList.push([{key:'partof',value:oLocation.id}]);
            }
            //res.send(listkeyValueParmsList);
            
            getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,
                function(listSousPrefecture)
            {
                console.log(`total =${listSousPrefecture.length}`)
                //Modified array
                //listSousPrefecture=listSousPrefecture.splice(0,2);
                if(listSousPrefecture && listSousPrefecture.length>0)
                {
                    let listSousPrefectureMapped=listSousPrefecture.filter(element =>{
                        if(element.identifier.find(id=>id.type.text=="siglid")){
                            return element;
                        }
                    });
                    listFacilityMapped=listFacilityMapped.concat(listSousPrefectureMapped);
                    listkeyValueParmsList=[];
                    for(let oLocation of listSousPrefecture)
                    {
                        //console.log(oLocation);
                        listkeyValueParmsList.push([{key:'partof',value:oLocation.id}]);
                    }
                    getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,
                        function(listeFormationSanitaires)
                    {
                        console.log(`Liste fosa =${listeFormationSanitaires.length}`);
                        if(listeFormationSanitaires && listeFormationSanitaires.length>0)
                        {
                            let listFosaMapped=listeFormationSanitaires.filter(element =>{
                                if(element.identifier.find(id=>id.type.text=="siglid")){
                                    return element;
                                }
                            });
                            listFacilityMapped=listFacilityMapped.concat(listFosaMapped);
                            console.log(`Fosa =${listFosaMapped.length}/${listeFormationSanitaires.length} Mapped`);
                            //get the list of location of the level of poste de santé and services
                            listkeyValueParmsList=[];
                            for(let oLocation of listeFormationSanitaires)
                            {
                                //console.log(oLocation);
                                listkeyValueParmsList.push([{key:'partof',value:oLocation.id}]);
                            }
                            getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,
                                function(listePosteSante)
                            {
                                console.log(`Liste poste= ${listePosteSante.length}`);
                                if(listePosteSante && listePosteSante.length>0)
                                {
                                    let listPosteSanteMapped=listePosteSante.filter(element =>{
                                        if(element.identifier.find(id=>id.type.text=="siglid")){
                                            return element;
                                        }
                                    });
                                    listFacilityMapped=listFacilityMapped.concat(listPosteSanteMapped);
                                    console.log(`Poste =${listPosteSanteMapped.length}/${listePosteSante.length} Mapped`);
                                }
                                else
                                {
                                    console.log(`Aucun Poste Santé trouvé pour la liste des FOSA`);
                                }
                                //Get Requistion from facility list mapped
                                let localAsync = require('async');
                                let listAllrequisitions=[];
                                //let reducedList=listFacilityMapped.splice(0,10);
                                localAsync.eachSeries(listFacilityMapped, function(facilityMapped, callback) {
                                    keyValueParmsList=[];
                                    let eSIGLFacilityIdentifier=facilityMapped.identifier.find(id=>id.type.text=="siglid");

                                    keyValueParmsList.push({key:`facilityId`,value:eSIGLFacilityIdentifier.value});
                                    keyValueParmsList.push({key:`periodId`,value:periodId});
                                    keyValueParmsList.push({key:`page`,value:0});
                                    keyValueParmsList.push({key:`pageSize`,value:100});
                                    
                                    getListApprovedRequisitionsByFacility3(eSIGLToken,keyValueParmsList,
                                        function(listRequisitions)
                                    {
                                        listAllrequisitions=listAllrequisitions.concat(listRequisitions);
                                        return callback();
                                    })

                                },function(error){
                                    if(error)
                                    {
                                        console.log(`Error while fetching the requisitions ${error}`);
                                    }
                                    console.log(`Fetched all ${listAllrequisitions.length}`);
                                    //Build requisition bundle item based on he structure definition
                                    let listAllBundleItemRequisitions=[];
                                    for(let oRequisition of listAllrequisitions)
                                    {
                                        listAllBundleItemRequisitions.push(
                                            buildRequisitionResourceEntryFromESIGL(oRequisition,config.extensionBaseUrlRequisitionDetails,
                                                config.esiglServer.url)
                                        )
                                    }
                                    //callback(listAllrequisitions);
                                    res.send(listAllBundleItemRequisitions)
                                    
                                })//end localAsync listFacilityMapped
                                

                            });
                        }
                        else
                        {
                            console.log(`Aucune FOSA trouvée pour la liste des sous prefecture`);
                        }
                       
                        //return res.send(listFacilityMapped);

                    })
                    
                }
                else{
                    console.log(`Aucune Sous-Prefecture trouvée pour la liste des prefectures`);
                    //Get Requistion from facility list mapped
                    let localAsync = require('async');
                    let listAllrequisitions=[];
                    //let reducedList=listFacilityMapped.splice(0,10);
                    console.log(`**** List Facilities mapped of ${listFacilityMapped.length}`)
                    localAsync.eachSeries(listFacilityMapped, function(facilityMapped, callback) {
                        keyValueParmsList=[];
                        let eSIGLFacilityIdentifier=facilityMapped.identifier.find(id=>id.type.text=="siglid");

                        keyValueParmsList.push({key:`facilityId`,value:eSIGLFacilityIdentifier.value});
                        keyValueParmsList.push({key:`periodId`,value:periodId});
                        keyValueParmsList.push({key:`page`,value:0});
                        keyValueParmsList.push({key:`pageSize`,value:100});
                        
                        getListApprovedRequisitionsByFacility3(eSIGLToken,keyValueParmsList,
                            function(listRequisitions)
                        {
                            console.log(`Returns ${listRequisitions.length} requisitons`)
                            listAllrequisitions=listAllrequisitions.concat(listRequisitions);
                            return callback();
                        })

                    },function(error){
                        if(error)
                        {
                            console.log(`Error while fetching the requisitions ${error}`);
                        }
                        console.log(`Fetched all ${listAllrequisitions.length}`);
                        //Build requisition bundle item based on he structure definition
                        let listAllBundleItemRequisitions=[];
                        for(let oRequisition of listAllrequisitions)
                        {
                            listAllBundleItemRequisitions.push(
                                buildRequisitionResourceEntryFromESIGL(oRequisition,config.extensionBaseUrlRequisitionDetails,
                                    config.esiglServer.url)
                            )
                        }
                        //callback(listAllrequisitions);
                        res.send(listAllBundleItemRequisitions)
                        
                    })//end localAsync listFacilityMapped
                }
                //listResourcesFound
            })
        }
        else
        {
            console.log(`Aucune Prefecture trouvée pour la region}`);
        }


    });


    
});
function getListHapiResourceFilteredByParamsFromIteration(hapiToken,fhirResource,listkeyValueParmsList,callbackMain)
{
    let localAsync = require('async');
    var listResourcesFound = [];
    localAsync.eachSeries(listkeyValueParmsList, function(keyValueParmsList, callback) {
        //console.log(keyValueParmsList);
        //console.log(`--------------------------`);
        getListHapiResourceFilteredByParams(hapiToken,fhirResource,keyValueParmsList,function (listResources){
            console.log(`Children founded ${listResources.length}`)
            listResourcesFound=listResourcesFound.concat(listResources);
            //console.log(`Founded ${listResourcesFound.length}`)
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
              /*console.log(`FHIR loop ${url}`);
              console.log('######################################################"')*/
              //url = false;
              if (err) {
                /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`${err.Error}`});*/
                console.log(`${err.Error}`)
                return callback(true, false);
              }
              if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
              /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Code d'erreur http: ${resp.statusCode}`});*/
                    console.log(`Code d'erreur http: ${resp.statusCode}`)
                  return callback(true, false);
              }
              let body = JSON.parse(resp.body);
              if (!body.entry) {
                /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`});*/
                      console.log(`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`)
                return callback(true, false);
              }
              if (body.total === 0 && body.entry && body.entry.length > 0) {
                /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`});*/
                console.log(`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`)
                return callback(true, false);
              }
              url = false;
              if (body.entry && body.entry.length > 0) {
                  //console.log(`returned a result`);
                  //console.log(body.entry);
                for(let oEntry of body.entry)
                {
                    resourceData.push(oEntry.resource);
                }
                //resourceData = resourceData.concat(body.entry);
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

function getListApprovedRequisitionsByFacility(eSIGLToken,keyValueParmsList,callbackMain){
    let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let options={headers:{'Content-Type': 'application/json','Authorization':eSIGLToken}};
    
    var url= URI(config.esiglServer.url).segment(config.esiglServer.resourcespath).segment(esigleResource.requitionsByFacility);
    for(let oDic of keyValueParmsList)
    {
      url.addQuery(`${oDic.key}`,`${oDic.value}`);
    }
    url=url.toString();
    console.log(`Requisition Url request: ${url}`)
    localNeedle.get(url,options, function(err, resp) {
        if(err)
        {
          logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
          message:`${err.Error}`});
          return callbackMain([]);
        }
        if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
            /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/sigl/${orchestration.name}`,result:typeResult.failed,
          message:`ESIGL: ${err.message}`});*/
          console.log(`ESIGL: ${err}`);
            }
        if (resp.statusCode && (resp.statusCode == 200)) {
            if(resp.body.data.rows.length>0)
            {
                //get only apporoved requisition
                let listApprovedRequisition=resp.body.data.rows.filter(element =>{
                    if(element.programCode==config.program.code && element.requisitionStatus=="APPROVED"){
                        return element;
                    }
                })
                return callbackMain(listApprovedRequisition);
            }
            else
            {
                console.log(`No requisition found for ${url.query()}`);
                return callbackMain();
            }
            
        
        }
  
        
      });//end of localNeedle
  }
function getListApprovedRequisitionsByFacility2(eSIGLToken,keyValueParmsList,callbackMain){
    let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let options={headers:{'Content-Type': 'application/json','Authorization':eSIGLToken}};
    let localAsync = require('async');
    var url= URI(config.esiglServer.url).segment(config.esiglServer.resourcespath).segment(esigleResource.requitionsByFacility);
    for(let oDic of keyValueParmsList)
    {
      url.addQuery(`${oDic.key}`,`${oDic.value}`);
    }
    url=url.toString();
    console.log(`Requisition Url request: ${url}`)
    let pageIndex=0;
      var resourceData = [];
      localAsync.whilst(
        callback => {
            return callback(null, url !== false);
          },
        callback => {
            
            localNeedle.get(url,options, function(err, resp) {
                //url = false;
                console.log(`Calling loop ${url}`);
                console.log('--------------------------------------');
                if (err) {
                  /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`${err.Error}`});*/
                  console.log(`${err.Error}`)
                  return callback(true, false);
                }
                if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
                /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Code d'erreur http: ${resp.statusCode}`});*/
                      console.log(`Code d'erreur http: ${resp.statusCode}`)
                    return callback(true, false);
                }
                if (resp.statusCode && (resp.statusCode == 200)) {
                    if(resp.body.data.rows.length>0)
                    {
                        //get only apporoved requisition
                        let listApprovedRequisition=resp.body.data.rows.filter(element =>{
                            if(element.programCode==config.program.code && element.requisitionStatus=="APPROVED"){
                                return element;
                            }
                        })
                        resourceData=resourceData.concat(listApprovedRequisition);
                        //return callbackMain(listApprovedRequisition);
                        console.log(`Retreived data = ${resp.body.data.rows.length}`);
                        if(resp.body.data.rows.length>0)
                        {
                            pageIndex++;
                            //rebuild url
                            var url= URI(config.esiglServer.url).segment(config.esiglServer.resourcespath).segment(esigleResource.requitionsByFacility);
                            for(let oDic of keyValueParmsList)
                            {
                                if(oDic.key=="page")
                                {
                                    url.addQuery(`${oDic.key}`,`${pageIndex}`);
                                    continue;
                                }
                                else{
                                    url.addQuery(`${oDic.key}`,`${oDic.value}`);
                                }
                            }
                            url=url.toString();
                            if(true)
                            {
                                console.log(`Second loop : ${url}`);
                                return callback(null, url);
                            } 
                        }
                        else
                        {
                            console.log(`resource Data completed: ${resourceData.length}`)
                            return callback(true, false);
                        }
                    }
                    else
                    {
                        console.log(`No requisition found for ${url.query()}`);
                        //return callbackMain();
                    }
                }

            })//end of needle.get
              
        },//end callback 2
        err=>{
            return callbackMain(resourceData);
  
        }
    );//end of async.whilst
  }
function getListApprovedRequisitionsByFacility3(eSIGLToken,keyValueParmsList,callbackMain)
  {
    let localNeedle = require('needle');
      localNeedle.defaults(
          {
              open_timeout: 600000
          });
      let options={headers:{'Content-Type': 'application/json','Authorization':eSIGLToken}};
      let localAsync = require('async');
      var resourceData = [];
      //var url= URI(config.hapiServer.url).segment(fhirResource);
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
                /*console.log(`FHIR loop ${url}`);
                console.log('######################################################"')*/
                //url = false;
                if (err) {
                  /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`${err.Error}`});*/
                  console.log(`Get error =${err.Error}`)
                  return callback(true, false);
                }
                if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
                /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Code d'erreur http: ${resp.statusCode}`});*/
                      console.log(`Code d'erreur http: ${resp.statusCode}`)
                    return callback(true, false);
                }
                //let body = JSON.parse(resp.body);
                let body=resp.body;
                if (!body.data) {
                  /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`});*/
                        console.log(`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`)
                  return callback(true, false);
                }
                if (body.data.totalRecords === 0 && body.data.rows.length > 0) {
                  /*logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                  message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`});*/
                  console.log(`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`)
                  return callback(true, false);
                }
                url = false;
                if (body.data && body.data.rows.length > 0) {
                    //console.log(`returned a result`);
                    //console.log(body.entry);
                    /*
                    let listApprovedRequisition=body.data.rows.filter(element =>{
                        if(element.requisitionStatus=="APPROVED" && element.programCode==config.program.code)
                        {
                            return element;
                        }
                    })
                    listApprovedRequisition=listApprovedRequisition.concat(body.data.rows);
                    if(listApprovedRequisition && listApprovedRequisition.length>0)
                    {
                        resourceData = resourceData.concat(listApprovedRequisition);
                        console.log(`${resourceData.length} requisitions retreived /${body.data.totalRecords} expected`)
                    }
                    else
                    {
                        console.log(`No approuved requisttion for ${initUrl}`)
                    }*/
                    resourceData = resourceData.concat(body.data.rows);
                    console.log(`${resourceData.length} requisitions retreived /${body.data.totalRecords} expected`)
                  
                   
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
            console.log(`*************Requisition fetch completed! Get Approuved requisitions************************`)
            let listApprovedRequisition=resourceData.filter(element =>{
                if(element.requisitionStatus=="APPROVED" && element.programCode==config.program.code)
                {
                    return element;
                }
            })
            console.log(`${config.program.code}: ${listApprovedRequisition.length} approuved requisitions/${resourceData.length} total`);
            return callbackMain(listApprovedRequisition);
  
        }
    );//end of async.whilst
  
  
  
  }
//To be added in the customLibrairy
function buildRequisitionResourceEntryFromESIGL(oRequisition,extensionBaseUrlRequisitionDetails,urlSIGLDomain){
	let extensionElements=[];
	var identifierCodingSystem=urlSIGLDomain+"/identifier-type";
	var oIdentifier=[];
	let resourceId=oRequisition.requisitionId+"-"+oRequisition.productCode+"-"+oRequisition.programCode;
	//let tempDate1=moment(oRequisition.periodStartDate,'YYYY-MM-DDTHH:mm:ssZ');
    let tempDate1=new Date(oRequisition.periodStartDate).toJSON();
	let createdDate=tempDate1.split("T")[0];
	//var createdDate=tempDate1.format('YYYY-MM-DD');
	let requisitionCode={coding:[{system:extensionBaseUrlRequisitionDetails,code:"requisition",display:"requisition"}],text:"requisition"};
	oIdentifier.push({
		use:"official",
		type:{coding:[{system:identifierCodingSystem,code:"requisitionId",display:"requisitionId"}],text:"requisitionId"},
		value:oRequisition.requisitionId
	});
	if(oRequisition.programCode){
		extensionElements.push(
			{
				url:"program",
				valueReference:{reference:"Organization/"+oRequisition.programCode}
		});
	}
	if(oRequisition.facilityId){
		extensionElements.push(
			{
				url:"location",
				valueReference:{reference:"Location/"+oRequisition.facilityId}
		});
	}
	if(oRequisition.periodName){
		extensionElements.push(
			{
				url:"periodName",
				valueString:oRequisition.periodName
			}
		);
	}
	if(oRequisition.periodStartDate){
		var tempDate= new Date(oRequisition.periodStartDate).toJSON();
		extensionElements.push(
			{
				url:"startDate",
				valueDate:tempDate.split("T")[0]
			}
		);
	}
	if(oRequisition.periodEndDate){
		var tempDate=new Date(oRequisition.periodEndDate).toJSON();

		extensionElements.push(
			{
				url:"endDate",
				valueDate:tempDate.split("T")[0]
			}
		);
	}
	if(oRequisition.productCode){
		extensionElements.push(
			{
				url:"product",
				valueReference:{reference:"Basic/"+oRequisition.productCode}
			}
		);
	}
	if(oRequisition.amc!=null && isNaN(oRequisition.amc)==false)
	{
		extensionElements.push(
			{
				url:"averageMonthConsumption",
				valueDecimal:parseFloat(oRequisition.amc)
			}
		);
	}
	if(oRequisition.beginningBalance!=null && isNaN(oRequisition.beginningBalance)==false)
	{
		extensionElements.push(
			{
				url:"initialStock",
				valueDecimal:parseFloat(oRequisition.beginningBalance)
			}
		);
	}
	if(oRequisition.quantityDispensed!=null && isNaN(oRequisition.quantityDispensed)==false)
	{
		extensionElements.push(
			{
				url:"consumedQuantity",
				valueDecimal:parseFloat(oRequisition.quantityDispensed)
			}
		);
	}
	if(oRequisition.quantityReceived!=null && isNaN(oRequisition.quantityReceived)==false)
	{
		extensionElements.push(
			{
				url:"receivedQuantity",
				valueDecimal:parseFloat(oRequisition.quantityReceived)
			}
		);
	}
	if(oRequisition.stockInHand!=null && isNaN(oRequisition.stockInHand)==false)
	{
		extensionElements.push(
			{
				url:"stockOnHand",
				valueDecimal:parseFloat(oRequisition.stockInHand)
			}
		);
	}
	if(oRequisition.stockOutDays!=null && isNaN(oRequisition.stockOutDays)==false)
	{
		extensionElements.push(
			{
				url:"stockOutDay",
				valueDecimal:parseFloat(oRequisition.stockOutDays)
			}
		);
	}
	if(oRequisition.totalLossesAndAdjustments!=null && isNaN(oRequisition.totalLossesAndAdjustments)==false)
	{
		extensionElements.push(
			{
				url:"losses",
				valueDecimal:parseFloat(oRequisition.totalLossesAndAdjustments)
			}
		);
	}
	extensionElements.push(
		{
			url:"reqElementType",
			valueString:'requisition'
		}
	);
	//let newRequisitionId=
	let requisitionResource={
		resourceType:"Basic",
		id:resourceId,
		identifier:oIdentifier,
		code:requisitionCode,
		created:createdDate,
		author:{"reference":"Organization/"+oRequisition.programCode},
		extension:[
			{
				url:extensionBaseUrlRequisitionDetails,
				extension:extensionElements
			}
		]
	}
	let requisitionEntry={
		resource:requisitionResource,
		request: {
			method: 'PUT',
			url: requisitionResource.resourceType + '/' + requisitionResource.id
		  }
	}
	return requisitionEntry;
	
}
console.log('App running on port 8001');