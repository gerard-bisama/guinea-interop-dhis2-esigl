const moment = require('moment');
const url=require('url');
 
//Return a bundle of Organization from the orgunit list
exports.buildOrganizationHierarchy =function buildOrganizationHierarchy(orgUnitList)
{
	var currentDate=moment().format();
	var currentZFormatDate=formatDateInZform(currentDate);
	
	for(var i=0;i<orgUnitList.lenght;i++)
	{
		
		var oOrgUnit=orgUnitList[i];
		var  orgUnitHref =url.parse(oOrgUnit.href);
		var typeCodingSystem=orgUnitHref.protocol+"//"+orgUnitHref.host+"/organization-type";
		var identifier=[
			{
				use:"official",
				type:{coding:[{system:typeCodingSystem,code:"Other",display:"dhis2Id"}],text:"dhis2Id"},
				
				
			}
		];
		var oOrganization={
			resourceType:"Organization",
			meta:{lastUpdated:currentZFormatDate},
			
			}
	}
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
	return formatedDate;
}
