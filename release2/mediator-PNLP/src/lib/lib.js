const path = require('path');
const fs = require('fs');
const csv=require('csvtojson');
const moment = require('moment');
const url=require('url');
var xml = require('xml');
var csvHeaderLog=['timestamp','level','label','operationType','action','result','message'];
var csvHeaderData=['code','id','iddhis','etablissement','categories','prefecture','possession','Adresse','telephone','fax'];

var csvHeaderMapping=['esigl','dhis2'];
var csvHeaderRequisition=['program_code','period_name','period_start_date','period_end_date','facility_id','requisition_id','product_id',
'product_code','amc','beginningbalance','quantitydispensed','quantityreceived','stockinhand','stockoutdays','totallossesandadjustments'];
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
const siglRequisitionCSVConverter={
    noheader:false,
    trim:true,
    headers:csvHeaderRequisition
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
//Same as above but exposed
exports.getListFiles2=function getListFiles2(logFilePath,dirName,callback)
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
exports.readAppLogFile=function readAppLogFile(filePath,callback){
	var data=[];
	csv(logCSVConverter).fromFile(filePath).then((jsonObj)=>{
		data=data.concat(jsonObj);
		callback(data); 
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
exports.readeSIGLRequisitionCSVFile=function readeSIGLRequisitionCSVFile(filePath,callback)
{
    var async = require('async');
    getListFiles(filePath,dataDireSIGL,function(listDataFiles){
		var fileRecords=[];
		var dataFile = listDataFiles[0];
		//console.log(listDataFiles);
		var csvFilePath = path.join(filePath, `${dataDireSIGL}/`+ dataFile);
		csv(siglRequisitionCSVConverter).fromFile(csvFilePath).then((jsonObj)=>{
            fileRecords=fileRecords.concat(jsonObj);
            callback(fileRecords);
        });

    })
}
exports.getContentSIGLRequisitionCSVFile=function getContentSIGLRequisitionCSVFile(filePath,fileName,callback)
{
	var fileRecords=[];
	var csvFilePath = path.join(filePath, `${dataDireSIGL}/`+ fileName);
		csv(siglRequisitionCSVConverter).fromFile(csvFilePath).then((jsonObj)=>{
            fileRecords=fileRecords.concat(jsonObj);
            callback(fileRecords);
        });	
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

exports.updateLocationFromSIGL=function updateLocationFromSIGL(listLocations,urlSIGLDomain,listSIGLFacilities)
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
		let oFacility=listSIGLFacilities.find(facility=>facility.iddhis==locationId);
		if(oFacility && oFacility.id)
		{
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
			if(oFacility.id)
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
		}
		listOfEntries.push({
			resource:listLocations[i],
			request: {
				method: 'PUT',
				url: listLocations[i].resourceType + '/' + listLocations[i].id,
				}
			});
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
exports.buildProgamProductRessourceBundle =function buildProgamProductRessourceBundle(programsList,productsList,
	programProductsList,urlSIGLDomain,extensionBaseUrlProductDetails,extensionBaseUrlProgramDetails){
	let bundleProducts={};
	let bundlePrograms={};
	var currentZFormatDate=moment().format('YYYY-MM-DDTHH:mm:ssZ');
	var listOfEntries=[];
	var fullUrl;
	let extensionElements=[];
	for(var i=0;i<productsList.length;i++)
	{
		extensionElements=[];
		var oProduct=productsList[i];
		var identifierCodingSystem=urlSIGLDomain+"/identifier-type";
		var oIdentifier=[];
		if(oProduct.id)
		{
			oIdentifier.push({
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"procuctId",display:"procuctId"}],text:"procuctId"},
				value:oProduct.id

			});
			//To generate id for dhis category combination
			let dhisId='produits'+oProduct.id;
			oIdentifier.push({
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"dhisId",display:"dhisId"}],text:"dhisId"},
				value:dhisId
			});

		}
		
		if(oProduct.code)
		{
			oIdentifier.push(
			{
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"productCode",display:"productCode"}],text:"productCode"},
				value:oProduct.code

			}
			);
		}
		if(oProduct.primaryName){
			extensionElements.push(
				{
					url:"primaryName",
					valueString:oProduct.primaryName
				}
			);
		}
		if(oProduct.fullName){
			extensionElements.push(
				{
					url:"fullName",
					valueString:oProduct.fullName
				}
			);
		}
		if(oProduct.dispensingUnit){
			extensionElements.push(
				{
					url:"dispensingUnit",
					valueString:oProduct.dispensingUnit
				}
			);
		}
		extensionElements.push(
			{
				url:"sigleElementType",
				valueString:"product"
			}
		);
		var productResource={
			resourceType:"Basic",
			id:oProduct.code,
			identifier:oIdentifier,
			extension:[
				{
					url:extensionBaseUrlProductDetails,
					extension:extensionElements
				}
			]
		}
		listOfEntries.push({
            resource:productResource,
            request: {
                method: 'PUT',
                url: productResource.resourceType + '/' + productResource.id,
              }
			});
	}//end of for
	//console.log("---------Products----------");
	//console.log(listOfEntries);
	if(listOfEntries.length>=1)
	{
		bundleProducts={
			resourceType : "Bundle",
			type: "batch",
			entry:listOfEntries
		};
	}
	//console.log(bundleProducts);
	listOfEntries=[];
	extensionElements=[];
	for(var i=0;i<programsList.length;i++)
	{
		extensionElements=[];
		var oProgram=programsList[i];
		var identifierCodingSystem=urlSIGLDomain+"/identifier-type";
		var oIdentifier=[];
		if(oProgram.id)
		{
			oIdentifier.push({
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"programId",display:"programId"}],text:"programId"},
				value:oProgram.id

			});
			let dhisId="";
			if((""+oProgram.id).length>1)
			{
				dhisId="program20"+oProgram.id;
			}
			else{
				dhisId="program200"+oProgram.id;
			}
			oIdentifier.push({
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"dhisId",display:"dhisId"}],text:"dhisId"},
				value:dhisId

			});
		}
		
		if(oProgram.code)
		{
			oIdentifier.push(
			{
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"programCode",display:"programCode"}],text:"programCode"},
				value:oProgram.code

			}
			);
		}
		//get the related program-products
		//let programProductElements= programProductsList.filter(programProductElement=>programProductElement.program.id=oProgram.id);
		let programProductElements= programProductsList.filter(element=>{
			if(element.program.id == oProgram.id)
			{
				return element;
			}
		});
		/* console.log("----- found programs-------");
		console.log(programProductElements); */

		if(programProductElements && programProductElements.length>0)
		{
			
			for(let progprodElement of programProductElements){
				let productReference=productsList.find(oProduct=>oProduct.id==progprodElement.product.id);
				extensionElements.push(
					{
						url:"providedProducts",
						valueReference:{reference:"Basic/"+productReference.code}
					}
				);
			}
		}
		var programmeResource={
			resourceType:"Organization",
			id:oProgram.code,
			identifier:oIdentifier,
			name:oProgram.name,
			extension:[
				{
					url:extensionBaseUrlProgramDetails,
					extension:extensionElements
				}
			]
		}
		listOfEntries.push({
            resource:programmeResource,
            request: {
                method: 'PUT',
                url: programmeResource.resourceType + '/' + programmeResource.id,
              }
			});
	}//end of for
	if(listOfEntries.length>=1)
	{
		bundlePrograms={
			resourceType : "Bundle",
			type: "batch",
			entry:listOfEntries
		};
	}
	//console.log(bundlePrograms);
	return [bundleProducts,bundlePrograms];
}
exports.buildRequisitionResourceEntry =function buildRequisitionResourceEntry(reqFileRecord,facilityId,
	extensionBaseUrlRequisitionDetails,urlSIGLDomain){
	let extensionElements=[];
	var identifierCodingSystem=urlSIGLDomain+"/identifier-type";
	var oIdentifier=[];
	let resourceId=reqFileRecord.requisition_id+"-"+reqFileRecord.product_code+"-"+reqFileRecord.program_code;
	let tempDate1=moment(reqFileRecord.period_start_date,'YYYY-MM-DDTHH:mm:ssZ');
	var createdDate=tempDate1.format('YYYY-MM-DD');
	let requisitionCode={coding:[{system:extensionBaseUrlRequisitionDetails,code:"requisition",display:"requisition"}],text:"requisition"};
	oIdentifier.push({
		use:"official",
		type:{coding:[{system:identifierCodingSystem,code:"requisitionId",display:"requisitionId"}],text:"requisitionId"},
		value:reqFileRecord.requisition_id
	});
	if(reqFileRecord.program_code){
		extensionElements.push(
			{
				url:"program",
				valueReference:{reference:"Organization/"+reqFileRecord.program_code}
		});
	}
	if(reqFileRecord.facility_id){
		extensionElements.push(
			{
				url:"location",
				valueReference:{reference:"Location/"+facilityId}
		});
	}
	if(reqFileRecord.period_name){
		extensionElements.push(
			{
				url:"periodName",
				valueString:reqFileRecord.period_name
			}
		);
	}
	if(reqFileRecord.period_start_date){
		var tempDate=moment(reqFileRecord.period_start_date,'YYYY-MM-DDTHH:mm:ssZ');
		extensionElements.push(
			{
				url:"startDate",
				valueDate:tempDate.format('YYYY-MM-DD')
			}
		);
	}
	if(reqFileRecord.period_end_date){
		var tempDate=moment(reqFileRecord.period_end_date,'YYYY-MM-DDTHH:mm:ssZ');

		extensionElements.push(
			{
				url:"endDate",
				valueDate:tempDate.format('YYYY-MM-DD')
			}
		);
	}
	if(reqFileRecord.product_code){
		extensionElements.push(
			{
				url:"product",
				valueReference:{reference:"Basic/"+reqFileRecord.product_code}
			}
		);
	}
	if(reqFileRecord.amc && isNaN(reqFileRecord.amc)==false)
	{
		extensionElements.push(
			{
				url:"averageMonthConsumption",
				valueDecimal:parseFloat(reqFileRecord.amc)
			}
		);
	}
	if(reqFileRecord.beginningbalance && isNaN(reqFileRecord.beginningbalance)==false)
	{
		extensionElements.push(
			{
				url:"initialStock",
				valueDecimal:parseFloat(reqFileRecord.beginningbalance)
			}
		);
	}
	if(reqFileRecord.quantitydispensed && isNaN(reqFileRecord.quantitydispensed)==false)
	{
		extensionElements.push(
			{
				url:"consumedQuantity",
				valueDecimal:parseFloat(reqFileRecord.quantitydispensed)
			}
		);
	}
	if(reqFileRecord.quantityreceived && isNaN(reqFileRecord.quantityreceived)==false)
	{
		extensionElements.push(
			{
				url:"receivedQuantity",
				valueDecimal:parseFloat(reqFileRecord.quantityreceived)
			}
		);
	}
	if(reqFileRecord.stockinhand && isNaN(reqFileRecord.stockinhand)==false)
	{
		extensionElements.push(
			{
				url:"stockOnHand",
				valueDecimal:parseFloat(reqFileRecord.stockinhand)
			}
		);
	}
	if(reqFileRecord.stockoutdays && isNaN(reqFileRecord.stockoutdays)==false)
	{
		extensionElements.push(
			{
				url:"stockOutDay",
				valueDecimal:parseFloat(reqFileRecord.stockoutdays)
			}
		);
	}
	if(reqFileRecord.totallossesandadjustments && isNaN(reqFileRecord.totallossesandadjustments)==false)
	{
		extensionElements.push(
			{
				url:"losses",
				valueDecimal:parseFloat(reqFileRecord.totallossesandadjustments)
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
		author:{"reference":"Organization/"+reqFileRecord.program_code},
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
exports.buildRequisitionResourceEntryFromESIGL=function buildRequisitionResourceEntryFromESIGL(oRequisition,extensionBaseUrlRequisitionDetails,urlSIGLDomain){
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
exports.buildRequisitionResourceWithRegionRefEntryFromESIGL=function buildRequisitionResourceWithRegionRefEntryFromESIGL(oRequisition,extensionBaseUrlRequisitionDetails,urlSIGLDomain,regionId){
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
	}/*
	if(oRequisition.totalLossesAndAdjustments!=null && isNaN(oRequisition.totalLossesAndAdjustments)==false)
	{
		extensionElements.push(
			{
				url:"losses",
				valueDecimal:parseFloat(oRequisition.totalLossesAndAdjustments)
			}
		);
	}*/
	if(oRequisition.losses!=null && isNaN(oRequisition.losses)==false)
	{
		extensionElements.push(
			{
				url:"losses",
				valueDecimal:parseFloat(oRequisition.losses)
			}
		);
	}
	if(oRequisition.positiveAdjustment!=null && isNaN(oRequisition.positiveAdjustment)==false)
	{
		extensionElements.push(
			{
				url:"positiveAdjustment",
				valueDecimal:parseFloat(oRequisition.positiveAdjustment)
			}
		);
	}
	if(oRequisition.negativeAdjustment!=null && isNaN(oRequisition.negativeAdjustment)==false)
	{
		extensionElements.push(
			{
				url:"NegativeAdjustment",
				valueDecimal:parseFloat(oRequisition.negativeAdjustment)
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
		subject:{"reference":"Location/"+regionId},
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

exports.buildCategoryOptionsMetadata=function buildCategoryOptionsMetadata(prefix,listProducts){
	let listCategoryOptions=[];
	for(let product of listProducts)
	{
		//dhisId=(prefix+product.id).toLowerCase().substr(0,11);
		
		let oIdentifier=product.identifier.find(id=>id.type.text=="dhisId");
		let dhisId=oIdentifier.value;
		let productDetail=product.extension[0].extension.find(extElement=>extElement.url=="primaryName");
		let oCategioryOption={
			id:dhisId,
			code:product.id,
			name:productDetail.valueString,
			shortName:productDetail.valueString.substr(0,50),
			displayName:productDetail.valueString
		}
		listCategoryOptions.push(oCategioryOption);
	}
	return listCategoryOptions;
}
exports.buildDataElementMetadata=function buildDataElementMetadata(prefixDataDict,programCode,programName,listDataelementDescription,categoryCombinationId){
	let listDEMetadata=[];
	//let programName=(programCode.split("-"))[2];
	let extractedPgCode=(programCode.split("-"))[2];
	for(let deDesc of listDataelementDescription)
	{
		let oDEMetadata={};
		if(deDesc.disagragetedByProduct== "true")
		{
			oDEMetadata={
				id:programName+deDesc.id,
				name:prefixDataDict+extractedPgCode+"_"+deDesc.name,
				shortName:(extractedPgCode+"_"+deDesc.name).substr(0,50),
				displayName:deDesc.displayName,
				valueType: "NUMBER",
				aggregationType:"SUM",
				domainType:"AGGREGATE",
				zeroIsSignificant:true,
				categoryCombo:{
					id:categoryCombinationId
				}
			}
		}
		else if(deDesc.disagragetedByProduct== "false")
		{
			oDEMetadata={
				id:programName+deDesc.id,
				name:extractedPgCode+"_"+deDesc.name,
				shortName:(extractedPgCode+"_"+deDesc.name).substr(0,50),
				displayName:deDesc.displayName,
				valueType: "NUMBER",
				aggregationType:"SUM",
				domainType:"AGGREGATE",
				zeroIsSignificant:true
			}
		}
		listDEMetadata.push(oDEMetadata);
	}
	return listDEMetadata;
}
exports.buildCategoryMetadata=function buildCategoryMetadata(programResource){
	let oIdentifier=programResource.identifier.find(id=>id.type.text=="dhisId");
	let dhisId=oIdentifier.value;
	let oCategory={
		id:dhisId,
		code:programResource.id,
		name:programResource.name,
		shortName:programResource.name.substr(0,50),
		displayName:programResource.name,
		dataDimensionType:"DISAGGREGATION",
		dimensionType: "CATEGORY"
	}
	return oCategory;	
}
exports.buildCategoryCombosMetadata=function buildCategoryCombosMetadata(programResource){
	let programIdentifier=programResource.identifier.find(id=>id.type.text=="programId");
	let dhisId="";
	if((programIdentifier.value).length>1)
	{
		dhisId="catcmbo20"+programIdentifier.value;
	}
	else{
		dhisId="catcmbo200"+programIdentifier.value;
	}
	let oIdentifier=programResource.identifier.find(id=>id.type.text=="dhisId");
	let oCategoryCombo={
		id:dhisId,
		code:programResource.id,
		name:programResource.name,
		shortName:programResource.name.substr(0,50),
		displayName:programResource.name,
		dataDimensionType:"DISAGGREGATION",
		categories: [
			{
				id:oIdentifier.value
			}
		]
	}
	return oCategoryCombo;	
}
function getProductProgramElement(programProductElement,programId)
{
	console.log("------in the loop----");
	console.log(programProductElement);
	if(programProductElement.program.id==programId)
	{
		return programProductElement;
	}
}
exports.buildObjectDetailsRequisitionList=function(listRequisitions,listProductWithDetails,programId){
	let listObjectDetailsRequisitions=[];
	for(let oRequisition of listRequisitions){
		let requisitionDetails={
			reqId:oRequisition.id,
			product:"",
			program:"",
			location:"",
			initialStock:0,
			receivedQuantity:0,
			consumedQuantity:0,
			losses:0,
			positiveAdjustment:0,
			negativeAdjustment:0,
			stockOnHand:0,
			averageMonthConsumption:0,
			stockOutDay:0,
			startDate:"",
			endDate:""
			};
		for(let extension of oRequisition.extension[0].extension)
		{
			var fieldName=extension.url;
			switch(fieldName)
			{
				case "product":
					//Get detailed product to extract the id
					var codeProduct=extension.valueReference.reference.split("/")[1];
					let reqProduct=listProductWithDetails.find(oProduct=>oProduct.id==codeProduct);
					let dhisIdentifier=reqProduct.identifier.find(id=>id.type.text=="dhisId");
					//requisitionDetails.product=dhisIdentifier.value;
					requisitionDetails.product=codeProduct;
					break;
				case "program":
					requisitionDetails.program=programId;
					break;
				case "location":
					var locationId=extension.valueReference.reference.split("/")[1];
					requisitionDetails.location=locationId;
					break;
				case "initialStock":
					requisitionDetails.initialStock=parseFloat(extension.valueDecimal);
					break;
				case "receivedQuantity":
					requisitionDetails.receivedQuantity=parseFloat(extension.valueDecimal);
					break;
				case "consumedQuantity":
					requisitionDetails.consumedQuantity=parseFloat(extension.valueDecimal);
					break;
				case "losses":
					//let floatValue=parseFloat(extension.valueDecimal);
					//if the value is gt  0 is a positive adjustement or ls 0 is losses or neg adjustment
					/*
					if(floatValue>0)
					{
						requisitionDetails.positiveAdjustment=parseFloat(extension.valueDecimal);
					}
					if(floatValue<0)
					{
						requisitionDetails.losses=parseFloat(extension.valueDecimal);
					}*/
					requisitionDetails.losses=parseFloat(extension.valueDecimal);
					break;
				case "positiveAdjustment":
					requisitionDetails.positiveAdjustment=parseFloat(extension.valueDecimal);
					break;
				case "NegativeAdjustment":
					requisitionDetails.negativeAdjustment=parseFloat(extension.valueDecimal);
					break;
				case "stockOnHand":
					requisitionDetails.stockOnHand=parseFloat(extension.valueDecimal);
					break;
				case "averageMonthConsumption":
					requisitionDetails.averageMonthConsumption=parseFloat(extension.valueDecimal);
					break;
				case "stockOutDay":
					requisitionDetails.stockOutDay=parseFloat(extension.valueDecimal);
					break;
				case "startDate":
					requisitionDetails.startDate=extension.valueDate;
					break;
				case "endDate":
					requisitionDetails.endDate=extension.valueDate;
					
			}//end switch
		}
		listObjectDetailsRequisitions.push(requisitionDetails);
	}
	return listObjectDetailsRequisitions;
}
//Build ADX xml file from requisitionObject
exports.buildADXPayloadFromRequisition=function(requisitionObject,metaDataConfig,programConfig)
{
	var currentZFormatDate=moment().format('YYYY-MM-DDTHH:mm:ssZ');;
	var validPeriodReported=requisitionObject.startDate;
	let idQuantiteUtilisee="";
	let idStockInitial="";
	let idQuantiteRecue="";
	let idSdu="";
	let idAjustementPositive="";
	let idAjustementNegative="";
	let idCMM="";
	let idNbJoursRupture="";
	let idPertes="";
	for(let configDataElement  of metaDataConfig)
	{
		if(configDataElement.id=="100001")
		{
			idQuantiteUtilisee=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100002")
		{
			idStockInitial=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100003")
		{
			idQuantiteRecue=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100004")
		{
			idSdu=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100005")
		{
			idAjustementPositive=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100006")
		{
			idAjustementNegative=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100007")
		{
			idCMM=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100008")
		{
			idNbJoursRupture=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100009")
		{
			idPertes=programConfig.name+configDataElement.id;
		}
	}
	var xmlObject=[{adx:[{_attr:{xmlns:'urn:ihe:qrph:adx:2015','xmlns:xsi':'http://www.w3.org/2001/XMLSchema-instance',
			'xsi:schemaLocation':'urn:ihe:qrph:adx:2015 ../schema/adx_loose.xsd',exported:currentZFormatDate}},
			{group:[{_attr:{orgUnit:requisitionObject.location,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idQuantiteUtilisee,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.consumedQuantity}}]},
				{dataValue:[{_attr:{dataElement:idStockInitial,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.initialStock}}]},
				{dataValue:[{_attr:{dataElement:idQuantiteRecue,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.receivedQuantity}}]},
				{dataValue:[{_attr:{dataElement:idSdu,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.stockOnHand}}]},
				{dataValue:[{_attr:{dataElement:idAjustementPositive,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.positiveAdjustment}}]},
				{dataValue:[{_attr:{dataElement:idAjustementNegative,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.negativeAdjustment}}]},
				{dataValue:[{_attr:{dataElement:idCMM,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.averageMonthConsumption}}]},
				{dataValue:[{_attr:{dataElement:idNbJoursRupture,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.stockOutDay}}]},
				{dataValue:[{_attr:{dataElement:idPertes,
					[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.losses}}]},
				]}]}]
	var resAdxPayLoad=xml(xmlObject);
	return resAdxPayLoad;	
}
exports.buildADXPayloadFromRequisitionsList=function(requisitionObjectsList,metaDataConfig,programConfig)
{
	var currentZFormatDate=moment().format('YYYY-MM-DDTHH:mm:ssZ');
	var xmlObject=[{adx:[]}];
	xmlObject[0].adx.push(
		{_attr:{xmlns:'urn:ihe:qrph:adx:2015','xmlns:xsi':'http://www.w3.org/2001/XMLSchema-instance',
			'xsi:schemaLocation':'urn:ihe:qrph:adx:2015 ../schema/adx_loose.xsd',exported:currentZFormatDate}}
	);
	let idQuantiteUtilisee="";
	let idStockInitial="";
	let idQuantiteRecue="";
	let idSdu="";
	let idAjustementPositive="";
	let idAjustementNegative="";
	let idCMM="";
	let idNbJoursRupture="";
	let idPertes="";
	for(let configDataElement  of metaDataConfig)
	{
		if(configDataElement.id=="100001")
		{
			idQuantiteUtilisee=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100002")
		{
			idStockInitial=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100003")
		{
			idQuantiteRecue=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100004")
		{
			idSdu=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100005")
		{
			idAjustementPositive=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100006")
		{
			idAjustementNegative=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100007")
		{
			idCMM=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100008")
		{
			idNbJoursRupture=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100009")
		{
			idPertes=programConfig.name+configDataElement.id;
		}
	}//end for metaDataConfig
	//limited to 100 for testing
	let compteur=0;
	for(let requisitionObject of requisitionObjectsList){
		compteur++;
		//if(compteur==2) break;
		let validPeriodReported=requisitionObject.startDate;
		
		let groupObject= {group:[{_attr:{orgUnit:requisitionObject.location,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
		{dataValue:[{_attr:{dataElement:idQuantiteUtilisee,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.consumedQuantity}}]},
		{dataValue:[{_attr:{dataElement:idStockInitial,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.initialStock}}]},
		{dataValue:[{_attr:{dataElement:idQuantiteRecue,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.receivedQuantity}}]},
		{dataValue:[{_attr:{dataElement:idSdu,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.stockOnHand}}]},
		{dataValue:[{_attr:{dataElement:idAjustementPositive,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.positiveAdjustment}}]},
		{dataValue:[{_attr:{dataElement:idAjustementNegative,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.negativeAdjustment}}]},
		{dataValue:[{_attr:{dataElement:idCMM,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.averageMonthConsumption}}]},
		{dataValue:[{_attr:{dataElement:idNbJoursRupture,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.stockOutDay}}]},
		{dataValue:[{_attr:{dataElement:idPertes,
			[`${programConfig.code}`]:requisitionObject.product,value:requisitionObject.losses}}]},
		]};
		xmlObject[0].adx.push(
			groupObject
		);
	}//end for requisitionLists
	var resAdxPayLoad=xml(xmlObject);
	return resAdxPayLoad;	
}
exports.buildADXPayloadFromDataElementsList=function(dataElementObjectsList,metaDataConfig,programConfig)
{
	var currentZFormatDate=moment().format('YYYY-MM-DDTHH:mm:ssZ');
	var xmlObject=[{adx:[]}];
	xmlObject[0].adx.push(
		{_attr:{xmlns:'urn:ihe:qrph:adx:2015','xmlns:xsi':'http://www.w3.org/2001/XMLSchema-instance',
			'xsi:schemaLocation':'urn:ihe:qrph:adx:2015 ../schema/adx_loose.xsd',exported:currentZFormatDate}}
	);
	let idNbreFosaRapportage="";
	let idNbrAjustementPositif="";
	let idNbrPertes="";
	let idNbrPertesAjustementNegatif="";
	let idNbreProduitSDUSup0="";
	let idNbreProduitSDUEq0="";
	let idNbreFosaRapportageParProduit="";
	for(let configDataElement  of metaDataConfig)
	{
		if(configDataElement.id=="100010")
		{
			idNbreFosaRapportage=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100011")
		{
			idNbrAjustementPositif=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100012")
		{
			idNbrPertesAjustementNegatif=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100013")
		{
			idNbreProduitSDUSup0=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100014")
		{
			idNbreProduitSDUEq0=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100015")
		{
			idNbreFosaRapportageParProduit=programConfig.name+configDataElement.id;
		}
		if(configDataElement.id=="100016")
		{
			idNbrPertes=programConfig.name+configDataElement.id;
		}
	}//end for metaDataConfig
	//limited to 100 for testing
	let compteur=0;
	for(let oDataElement of dataElementObjectsList){
		compteur++;
		//if(compteur==2) break;
		let validPeriodReported=oDataElement.periodReported;
		if(oDataElement.type=="fosaReported")
		{
			if(oDataElement.categoryCombo==null)
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbreFosaRapportage,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			else
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbreFosaRapportage,
					[`${oDataElement.categoryCombo.id}`]:oDataElement.categoryCombo.combinationId,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			
		}
		if(oDataElement.type=="fosaNegAjustement")
		{
			if(oDataElement.categoryCombo==null)
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbrPertesAjustementNegatif,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			else
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbrPertesAjustementNegatif,
					[`${oDataElement.categoryCombo.id}`]:oDataElement.categoryCombo.combinationId,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			
		}
		if(oDataElement.type=="fosaLosses")
		{
			if(oDataElement.categoryCombo==null)
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbrPertes,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			else
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbrPertes,
					[`${oDataElement.categoryCombo.id}`]:oDataElement.categoryCombo.combinationId,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			
		}
		if(oDataElement.type=="fosaPosAjustement")
		{
			if(oDataElement.categoryCombo==null)
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbrAjustementPositif,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			else
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbrAjustementPositif,
					[`${oDataElement.categoryCombo.id}`]:oDataElement.categoryCombo.combinationId,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
		}
		if(oDataElement.type=="fosaSDUeq0")
		{
			if(oDataElement.categoryCombo==null)
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbreProduitSDUEq0,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			else
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbreProduitSDUEq0,
					[`${oDataElement.categoryCombo.id}`]:oDataElement.categoryCombo.combinationId,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
		}
		if(oDataElement.type=="fosaSDUgt0")
		{
			if(oDataElement.categoryCombo==null)
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbreProduitSDUSup0,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			else
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbreProduitSDUSup0,
					[`${oDataElement.categoryCombo.id}`]:oDataElement.categoryCombo.combinationId,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
		}
		if(oDataElement.type=="fosaReportedPerProduct")
		{
			if(oDataElement.categoryCombo==null)
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbreFosaRapportageParProduit,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
			else
			{
				let groupObject= {group:[{_attr:{orgUnit:oDataElement.idFacility,period:validPeriodReported+"/P1M",completeDate:currentZFormatDate}},
				{dataValue:[{_attr:{dataElement:idNbreFosaRapportageParProduit,
					[`${oDataElement.categoryCombo.id}`]:oDataElement.categoryCombo.combinationId,value:oDataElement.dataElement}}]}
				]};
				xmlObject[0].adx.push(groupObject);
			}
		}
		
	}//end for requisitionLists
	var resAdxPayLoad=xml(xmlObject);
	return resAdxPayLoad;	
}



