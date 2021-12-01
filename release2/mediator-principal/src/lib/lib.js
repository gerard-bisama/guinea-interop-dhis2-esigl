const path = require('path');
const fs = require('fs');
const csv=require('csvtojson');
const moment = require('moment');
const url=require('url');
var csvHeaderLog=['timestamp','level','label','operationType','action','result','message'];
//var csvHeaderData=['code','id','iddhis','etablissement','categories','prefecture','possession','Adresse','telephone','fax'];
var csvHeaderData=['code','id','iddhis','etablissement','categories','region','prefecture'];
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
	var createdDate=moment().format('YYYY-MM-DD');
	var listOfEntries=[];
	let extensionElements=[];
	
	let productCode={coding:[{system:extensionBaseUrlProgramDetails,code:"product",display:"product"}],text:"product"};
	
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
			let cleanedProductName= oProduct.primaryName.split(",").join(" ");
			cleanedProductName= cleanedProductName.split("/").join(" ");
			extensionElements.push(
				{
					url:"primaryName",
					valueString:cleanedProductName
				}
			);
		}
		if(oProduct.fullName){
			let cleanedProductName= oProduct.fullName.split(",").join(" ");
			cleanedProductName= cleanedProductName.split("/").join(" ");
			extensionElements.push(
				{
					url:"fullName",
					valueString:cleanedProductName
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
			code:productCode,
			created:createdDate,
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
exports.buildCategoryComboOptionsMetadata=function buildCategoryComboOptionsMetadata(listProduct,listGeneratedCatComboOptions){
	let listCategoryComboOptions=[];
	for(let catComboOptions of listGeneratedCatComboOptions)
	{
		let nameCatComboOptions=catComboOptions.displayName.split(" ").join("");
		let relatedProduct=listProduct.find(oProduct=>oProduct.name.split(" ").join("")== nameCatComboOptions)
		if(relatedProduct)
		{
			let oCategioryComboOption={
				id:catComboOptions.id,
				code:relatedProduct.id,
				
			}
			listCategoryComboOptions.push(oCategioryComboOption);
		}
		
	}
	return listCategoryComboOptions;
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


