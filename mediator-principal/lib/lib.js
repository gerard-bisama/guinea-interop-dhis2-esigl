const path = require('path');
const fs = require('fs');
const csv=require('csvtojson');
const moment = require('moment');
const url=require('url');
var csvHeaderLog=['timestamp','level','label','operationType','action','result','message'];
var csvHeaderData=['code','id','etablissement','categories','prefecture','possession','Adresse','telephone','fax'];
var csvHeaderMapping=['esigl','dhis2'];
const logCSVConverter={
    noheader:true,
    trim:true,
    headers:csvHeaderLog
};
const siglDataCSVConverter={
    noheader:false,
    trim:true,
    headers:csvHeaderData
};
const mappingCSVConverter={
    noheader:false,
    trim:true,
    headers:csvHeaderMapping
};
//const filePath="/home/server-dev/Documents/dev_repo/node_working_dir";
const logDirName="logs";
const dataDireSIGL="data";
const mappingDirName="mapping"

//Return list of fileName within a Path
function getListFiles(logFilePath,dirName,callback)
{
    var listLogFiles=[];
    const directoryPath = path.join(logFilePath, dirName);
    fs.readdir(directoryPath, function (err, files) {
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        } 
        files.forEach(function (file) {
            listLogFiles.push(file);
        });
        return callback(listLogFiles);
    });
}
//Return collection of {fileName,[record]} from log directory
exports.readLogCSVFile=function readLogCSVFile(filePath,callback)
{
    var async = require('async');
    getListFiles(filePath,logDirName,function(listLogFiles){
        var fileRecords=[];
        async.each(listLogFiles, function(logFile, callbackAsync) {
            var record={
                fileName:logFile,
                data:[]
            } ;
            var csvFilePath = logFile;
            var csvFilePath = path.join(filePath, `${logDirName}/`+ logFile);
            csv(logCSVConverter).fromFile(csvFilePath).then((jsonObj)=>{
            record.data=record.data.concat(jsonObj);
            fileRecords.push(record)
            callbackAsync(); 
            })
        },function(err)
        {
            if(err)
            {
                console.log(err);
            }
            callback(fileRecords);
        });

    })
}
exports.readeSIGLDataCSVFile=function readeSIGLDataCSVFile(filePath,callback)
{
    var async = require('async');
    getListFiles(filePath,dataDireSIGL,function(listDataFiles){
		var fileRecords=[];
		var dataFile = listDataFiles[0];
		//console.log(listDataFiles);
		var csvFilePath = path.join(filePath, `${dataDireSIGL}/`+ dataFile);
		csv(siglDataCSVConverter).fromFile(csvFilePath).then((jsonObj)=>{
            fileRecords=fileRecords.concat(jsonObj);
            callback(fileRecords);
        });

    })
}
exports.readMappingCSVFile=function readMappingCSVFile(filePath,callback)
{
    var async = require('async');
    getListFiles(filePath,mappingDirName,function(listDataFiles){
		var fileRecords=[];
		var dataFile = listDataFiles[0];
		//console.log(listDataFiles);
		var csvFilePath = path.join(filePath, `${mappingDirName}/`+ dataFile);
		csv(mappingCSVConverter).fromFile(csvFilePath).then((jsonObj)=>{
            fileRecords=fileRecords.concat(jsonObj);
            callback(fileRecords);
        });

    })
}
//Return a bundle of Organization from the orgunit list
exports.buildLocationHierarchy =function buildLocationHierarchy(orgUnitList)
{
	var currentZFormatDate=moment().format('YYYY-MM-DDTHH:mm:ssZ');
	var listOfEntries=[];
	var fullUrl;
	for(var i=0;i<orgUnitList.length;i++)
	{

		var oOrgUnit=orgUnitList[i];
		var  orgUnitHref =url.parse(oOrgUnit.href);
		var identifierCodingSystem=orgUnitHref.protocol+"//"+orgUnitHref.host+"/identifier-type";
		var orgUnitTypeCodingSystem=orgUnitHref.protocol+"//"+orgUnitHref.host+"/location-type";
		var oIdentifier=[];
		oIdentifier.push({
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"dhis2Id",display:"dhis2Id"}],text:"dhis2Id"},
				value:oOrgUnit.id

			});
		if(oOrgUnit.code!=null)
		{
			oIdentifier.push(
			{
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"dhis2Code",display:"dhis2Code"}],text:"dhis2Code"},
				value:oOrgUnit.code

			}
			);
		}
		var locationType=[];
		if(oOrgUnit.level!=null)
		{
			locationType.push(
			{coding:[{system:orgUnitTypeCodingSystem,code:"level",display:"level"}],text:oOrgUnit.level}
			);
		}
		var isPartOf=null;
		if(oOrgUnit.parent!=null)
		{
			isPartOf={"reference":"Location/"+oOrgUnit.parent.id};
		}
		var oLocation={
			resourceType:"Location",
			id:oOrgUnit.id,
			meta:{lastUpdated:currentZFormatDate},
			identifier:oIdentifier,
			type:locationType,
			name:oOrgUnit.displayName,
			partOf:isPartOf

		}
		listOfEntries.push({
            resource:oLocation,
            request: {
                method: 'PUT',
                url: oLocation.resourceType + '/' + oLocation.id,
              }
			});
	}//end of for
	let oBundle={
		resourceType : "Bundle",
		type: "batch",
		entry:listOfEntries
		};
	//console.log(JSON.stringify(oBundle));
	return oBundle;
}

exports.updateLocationFromSIGL=function updateLocationFromSIGL(listLocations,urlSIGLDomain,listSIGLFacilities,listMappings)
{
	var listOfEntries=[];
	for(let i=0;i<listLocations.length;i++)
	{
		//check if the location has been already mapped
		var mapped= listLocations[i].identifier.find(identifier=>identifier.type.text=='siglcode')
		|| listLocations[i].identifier.find(identifier=>identifier.type.text=='siglid');
		if(mapped)
		{
			//console.log('Already mapped!');
			let identifierDHIS2=[];
			let dhisId=listLocations[i].identifier.find(identifier=>identifier.type.text=='dhis2Id');
			if(dhisId){
				identifierDHIS2.push(dhisId);
			}
			dhisId=null;
			dhisId=listLocations[i].identifier.find(identifier=>identifier.type.text=='dhis2Code');
			if(dhisId){
				identifierDHIS2.push(dhisId);
			}
			let dhisType=listLocations[i].type.find(type=>type.coding[0].code=='level');
			/* console.log(dhisType);
			console.log(identifierDHIS2); */
			listLocations[i].identifier=[];
			listLocations[i].type=[];
			listLocations[i].identifier=identifierDHIS2;
			listLocations[i].type.push(dhisType);
			

		}
		let dhisIdentifier=listLocations[i].identifier.find(identifier=>identifier.type.text=='dhis2Id');
		let locationId=dhisIdentifier && dhisIdentifier.value;
		let oMapping=listMappings.find(mapping=>mapping.dhis2==locationId);
		let oFacility=listSIGLFacilities.find(facility=>facility.id==oMapping.esigl);

		var facilityTypeCodingSystem=urlSIGLDomain+"/facility-type";
		var eSIGLType=[];
		if(oFacility.categories){
			eSIGLType.push(
				{
					coding:[{system:facilityTypeCodingSystem,code:"categorie".code,display:"categorie"}],
					text:oFacility.categories
				}
			)
		}
		if(oFacility.possession){
			eSIGLType.push(
				{
					coding:[{system:facilityTypeCodingSystem,code:"possession".code,display:"possession"}],
					text:oFacility.possession
				}
			)
		}
		var identifierCodingSystem=urlSIGLDomain+"/facility-code";
		var eSIGLIdentifier=[];
		if(oFacility.code)
		{
			eSIGLIdentifier.push(
				{
					use:"official",
					type:{coding:[{system:identifierCodingSystem,code:"siglcode",display:"siglcode"}],text:"siglcode"},
					value: oFacility.code
				}
			)
		}
		if(oFacility.code)
		{
			eSIGLIdentifier.push(
				{
					use:"official",
					type:{coding:[{system:identifierCodingSystem,code:"siglid",display:"siglid"}],text:"siglid"},
					value: oFacility.id
				}
			)
		}
		if(listLocations[i].identifier)
		{
			listLocations[i].identifier=listLocations[i].identifier.concat(eSIGLIdentifier);
		}
		if(listLocations[i].type){
			listLocations[i].type=listLocations[i].type.concat(eSIGLType);
		}
		listOfEntries.push({
			resource:listLocations[i],
			request: {
				method: 'PUT',
				url: listLocations[i].resourceType + '/' + listLocations[i].id,
				}
			});
			//console.log(listLocations[i]);
	}//end for
	let oBundle=null;
	if(listOfEntries.length>0)
	{
		oBundle={
			resourceType : "Bundle",
			type: "batch",
			entry:listOfEntries
		};
	}
	return oBundle;

}



