const moment = require('moment');
const url=require('url');
const manifest = require('../config/manifest')
const uuidv1 = require('uuid/v1');
 var csvUtil = require('csv-util');
 
//Return a bundle of Organization from the orgunit list
exports.buildOrganizationHierarchy =function buildOrganizationHierarchy(orgUnitList)
{
	//console.log("Entered :"+orgUnitList.length);
	var currentDate=moment().format(new Date().toJSON());
	var currentZFormatDate=formatDateInZform(currentDate);
	var listOfEntries=[];
	var fullUrl;
	for(var i=0;i<orgUnitList.length;i++)
	{
		
		var oOrgUnit=orgUnitList[i];
		//console.log(oOrgUnit);
		//fullUrl=oOrgUnit.href;
		var  orgUnitHref =url.parse(oOrgUnit.href);
		var identifierCodingSystem=orgUnitHref.protocol+"//"+orgUnitHref.host+"/identifier-type";
		var orgUnitTypeCodingSystem=orgUnitHref.protocol+"//"+orgUnitHref.host+"/organisation-type";
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
		//console.log("Orgunit level:"+oOrgUnit.level);
		var orgUnitLevel=getOrgUnitLevelInformation(oOrgUnit.level);
		var organizationType=[];
		if(orgUnitLevel!=null)
		{
			organizationType.push(
			{coding:[{system:orgUnitTypeCodingSystem,code:"level",display:""+orgUnitLevel.id}],text:orgUnitLevel.text}
			);
		}
		var isPartOf=null;
		if(oOrgUnit.parent!=null)
		{
			isPartOf={"reference":"Organization/"+oOrgUnit.parent.id};
			//isPartOf={"reference":"Organization/53"};//for testing purpose
		}
		var oOrganization={
			resourceType:"Organization",
			id:oOrgUnit.id,
			meta:{lastUpdated:currentZFormatDate},
			identifier:oIdentifier,
			type:organizationType,
			name:oOrgUnit.displayName,
			partOf:isPartOf
			
		}
		//console.log(oOrganization);
		var entryUUID=""+new Date().toJSON().replace(/:/g,"-");
		//entryUUID=entryUUID.replace(/./g,"-");
		entryUUID=entryUUID.toLowerCase();
		listOfEntries.push({
			//fullURL:oOrgUnit.href,
			//fullURL:"urn:uuid:"+uuidv1(),
			//fullURL:"http://192.168.1.148:8083/hapi-fhir-jpaserver/fhir/Organization/"+oOrganization.id,
			resource:oOrganization,
			search:{mode:"match"}
			});
	}//end of for
	var idBundle="datasource-"+new Date().toJSON();
	var tempResult=idBundle.replace(/:/g,"");//replace all occurence of : by ""
	idBundle=tempResult.replace(".","");
	var oBundle={
		//id:idBundle,
		id:uuidv1(),
		resourceType : "Bundle",
		type: "collection",
		entry:listOfEntries
		};
	//console.log(JSON.stringify(oBundle));
	return oBundle;
}
//Return the id and the text of orgunit Level 
//@param OrgUnitLevel
function getOrgUnitLevelInformation(orgUnitLevel)
{
	var oUnitLevel=null;
	//console.log(manifest.dhis2OrgUnitLevel);
	for (var i=0;i< manifest.dhis2OrgUnitLevel.length;i++)
	{
		var unitLevel=manifest.dhis2OrgUnitLevel[i];
		//console.log(unitLevel);
		//console.log("-----------");
		if(unitLevel.id==orgUnitLevel)
		{
			oUnitLevel=unitLevel;
			break;
		}
	}
	return oUnitLevel;
}
//Return the list of Organization by level as specified in the 
exports.getOrganizationByLevel=function getOrganizationByLevel(level,organizationsList)
{
	var organizationsFounded=[];
	for(var indexOrganization=0;indexOrganization<organizationsList.length;indexOrganization++)
	{
		var typeList=organizationsList[indexOrganization].resource.type;
		//console.log(organizationsList[indexOrganization]);
		for(var indexType=0;indexType<typeList.length;indexType++)
		{
			if(typeList[indexType].coding[0].code=="level" && typeList[indexType].coding[0].display==level)
			{
				organizationsFounded.push(organizationsList[indexOrganization].resource);
			}
		}
	}
	return organizationsFounded;
}
//Update organization from eSIGL Facility and factility-type
exports.updateOrganizationFromeSIGL=function updateOrganizationFromeSIGL(eSIGLFacility,eSIGLFacilityType,oOrganization,hrefDomaineSIGL)
{
	var facilityTypeCodingSystem=hrefDomaineSIGL+"/facility-type";
	var eSIGLType={coding:[{system:facilityTypeCodingSystem,code:"facility-type",display:eSIGLFacilityType.id}],text:eSIGLFacilityType.code};
	var identifierCodingSystem=hrefDomaineSIGL+"/facility-code";
	var identifier=[{
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"code",display:"code"}],text:"code"},
				value:eSIGLFacility.code},
				{
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"id",display:"id"}],text:"id"},
				value:eSIGLFacility.id},
			];
	
}

//Format the string date ISO8601 from DHIS2 in Zform (Zulu time Zone) whikch is the format accepted by HAPI Fhir Server
//The format looks like  yyyy-mm-ddThh:mm:ss+zz:zz ; the last part is the zone indicator
function formatDateInZform(originalDate)
{
	var formatedDate="";
	var dateComponants=[];
	//Check if at least it is timedate format
	var dateCorrected="";
	if(originalDate.includes("T")==false)
	{
		dateCorrected=originalDate.replace(" ","T");    
		//console.log("date: "+originalDate);                 
	}
	else
	{
		dateCorrected=originalDate;
	}
	var dateComponants=dateCorrected.split("+");
	if(dateComponants.length>0)
	{
		formatedDate=dateComponants[0];//+"+00:00"
		//formatedDate+="+00:00";
		if(formatedDate.includes("Z")||formatedDate.includes("z"))
		{
			var dateComponant2=formatedDate.split("Z");
			formatedDate=dateComponant2[0];
		}
		/*
		else
		{
			//formatedDate+="+00:00";
			formatedDate+="Z";
		}
		* */
	}
	return formatedDate+manifest.typeZone;
}
//read CSV file as specified 
//@@ _filename: full path of the file name
exports.readCSVFile=function readCSVFile(_filename,callback)
{
	//var filename=path.resolve(path.join(manifest.source_directory, "/", _filename));
	var filename=_filename;
	var csvParser = csvUtil.csvParser;
	var csvData = csvParser(filename,function(row){
	  var newRow = row.map(function(value,index){
		return value;
	  })
	  return newRow
	}).then(function(csvData){
  		return callback(csvData);
	});
}
