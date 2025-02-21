# Structure of the mediator: principal
Principal mediator: is used for general operation commons to all mediators.It is used for the following operations
  * Extract the list of facilities (geographic and service delivery points) from DHIS2 (orgUnits) to store in HAPI (Location). The DHIS2 is considered as the master list.
  * Map the list of facilities extracted from DHIS2 to the corresponding e-SIGL using IDs. This process is done throught the use of excel file with contains mapp the DHIS2 ID=>e-SIGL ID
  * Extract the list of products and associated program from e-SIGL to HAPI server. Then push them in to DHIS2.
  * Process the metadata on the products and program to facilitate the exchange of data. P.ex: Update the categorycombo of the products in DHIS2 by adding the generating the content of the "code" fields which is empty sometimes but used in ADX data pushed into DHIS2.