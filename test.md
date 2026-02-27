AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az monitor app-insights component create \
  --app income-rec-tool-staging-insights \
  --resource-group income-rec-tool-staging \
  --location uksouth \
  --kind web
{
  "appId": "fef898c4-fffa-4ded-979e-3b0185d6f395",
  "applicationId": "income-rec-tool-staging-insights",
  "applicationType": "web",
  "connectionString": "InstrumentationKey=389a01e8-8613-481a-a897-1059ae4cdc1e;IngestionEndpoint=https://uksouth-1.in.applicationinsights.azure.com/;LiveEndpoint=https://uksouth.livediagnostics.monitor.azure.com/;ApplicationId=fef898c4-fffa-4ded-979e-3b0185d6f395",
  "creationDate": "2026-02-27T15:32:49.820051+00:00",
  "disableIpMasking": null,
  "etag": "\"6b049c3a-0000-0200-0000-69a1b9270000\"",
  "flowType": "Bluefield",
  "hockeyAppId": null,
  "hockeyAppToken": null,
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/microsoft.insights/components/income-rec-tool-staging-insights",
  "immediatePurgeDataOn30Days": null,
  "ingestionMode": "LogAnalytics",
  "instrumentationKey": "389a01e8-8613-481a-a897-1059ae4cdc1e",
  "kind": "web",
  "location": "uksouth",
  "name": "income-rec-tool-staging-insights",
  "privateLinkScopedResources": null,
  "provisioningState": "Succeeded",
  "publicNetworkAccessForIngestion": "Enabled",
  "publicNetworkAccessForQuery": "Enabled",
  "requestSource": "rest",
  "resourceGroup": "income-rec-tool-staging",
  "retentionInDays": 90,
  "samplingPercentage": null,
  "tags": {},
  "tenantId": "5aadac3d-4ce6-4394-8ef2-cc48ea7a6822",
  "type": "microsoft.insights/components"
}







AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az postgres flexible-server create \
  --name income-rec-tool-staging-db \
  --resource-group income-rec-tool-staging \
  --location uksouth \
  --admin-user incomerecadmin \
  --admin-password "<strong-password>" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --public-access 0.0.0.0
Checking the existence of the resource group 'income-rec-tool-staging'...
Resource group 'income-rec-tool-staging' exists ? : True
Creating PostgreSQL Server 'income-rec-tool-staging-db' in group 'income-rec-tool-staging'...
Your server 'income-rec-tool-staging-db' is using sku 'Standard_B1ms' (Paid Tier). Please refer to https://aka.ms/postgres-pricing for pricing details
Configuring server firewall rule, 'azure-access', to accept connections from all Azure resources...
Make a note of your password. If you forget, you would have to reset your password with "az postgres flexible-server update -n income-rec-tool-staging-db -g income-rec-tool-staging -p <new-password>".
Try using 'az postgres flexible-server connect' command to test out connection.
{
  "connectionString": "postgresql://incomerecadmin:<strong-password>@income-rec-tool-staging-db.postgres.database.azure.com/postgres?sslmode=require",
  "databaseName": "postgres",
  "firewallName": "AllowAllAzureServicesAndResourcesWithinAzureIps_2026-2-27_21-9-52",
  "host": "income-rec-tool-staging-db.postgres.database.azure.com",
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.DBforPostgreSQL/flexibleServers/income-rec-tool-staging-db",
  "location": "UK South",
  "password": "<strong-password>",
  "resourceGroup": "income-rec-tool-staging",
  "skuname": "Standard_B1ms",
  "username": "incomerecadmin",
  "version": "16"
}







AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az postgres flexible-server db create \
  --server-name income-rec-tool-staging-db \
  --resource-group income-rec-tool-staging \
  --database-name income_rec_staging
Creating database with utf8 charset and en_US.utf8 collation
{
  "charset": "UTF8",
  "collation": "en_US.utf8",
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.DBforPostgreSQL/flexibleServers/income-rec-tool-staging-db/databases/income_rec_staging",
  "name": "income_rec_staging",
  "resourceGroup": "income-rec-tool-staging",
  "systemData": null,
  "type": "Microsoft.DBforPostgreSQL/flexibleServers/databases"
}





AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az appservice plan create \
  --name income-rec-tool-staging-plan \
  --resource-group income-rec-tool-staging \
  --location ukwest \
  --sku B2 \
  --is-linux
{
  "asyncScalingEnabled": false,
  "elasticScaleEnabled": false,
  "freeOfferExpirationTime": "2026-03-29T15:50:48.5333333",
  "geoRegion": "UK West",
  "hyperV": false,
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.Web/serverfarms/income-rec-tool-staging-plan",
  "isCustomMode": false,
  "isSpot": false,
  "isXenon": false,
  "kind": "linux",
  "location": "ukwest",
  "maximumElasticWorkerCount": 1,
  "maximumNumberOfWorkers": 0,
  "name": "income-rec-tool-staging-plan",
  "numberOfSites": 0,
  "numberOfWorkers": 1,
  "perSiteScaling": false,
  "provisioningState": "Succeeded",
  "reserved": true,
  "resourceGroup": "income-rec-tool-staging",
  "sku": {
    "capacity": 1,
    "family": "B",
    "name": "B2",
    "size": "B2",
    "tier": "Basic"
  },
  "status": "Ready",
  "subscription": "5aadac3d-4ce6-4394-8ef2-cc48ea7a6822",
  "targetWorkerCount": 0,
  "targetWorkerSizeId": 0,
  "type": "Microsoft.Web/serverfarms",
  "zoneRedundant": false
}






AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az webapp create \
  --name income-rec-tool-staging-api \
  --resource-group income-rec-tool-staging \
  --plan income-rec-tool-staging-plan \
  --runtime "NODE:22-lts"
vnet_route_all_enabled is not a known attribute of class <class 'azure.mgmt.web.v2024_11_01.models._models_py3.Site'> and will be ignored
{
  "autoGeneratedDomainNameLabelScope": null,
  "availabilityState": "Normal",
  "clientAffinityEnabled": true,
  "clientAffinityPartitioningEnabled": null,
  "clientAffinityProxyEnabled": false,
  "clientCertEnabled": false,
  "clientCertExclusionPaths": null,
  "clientCertMode": "Required",
  "cloningInfo": null,
  "containerSize": 0,
  "customDomainVerificationId": "E2F47525F4A6950F9A9D9D450EFC42DD5DDD40CA3D67A7DF3637C7362360D5F5",
  "dailyMemoryTimeQuota": 0,
  "daprConfig": null,
  "defaultHostName": "income-rec-tool-staging-api.azurewebsites.net",
  "dnsConfiguration": {
    "dnsAltServer": null,
    "dnsLegacySortOrder": null,
    "dnsMaxCacheTimeout": null,
    "dnsRetryAttemptCount": null,
    "dnsRetryAttemptTimeout": null,
    "dnsServers": null
  },
  "enabled": true,
  "enabledHostNames": [
    "income-rec-tool-staging-api.azurewebsites.net",
    "income-rec-tool-staging-api.scm.azurewebsites.net"
  ],
  "endToEndEncryptionEnabled": false,
  "extendedLocation": null,
  "ftpPublishingUrl": "ftps://waws-prod-cw1-037.ftp.azurewebsites.windows.net/site/wwwroot",
  "functionAppConfig": null,
  "hostNameSslStates": [
    {
      "certificateResourceId": null,
      "hostType": "Standard",
      "ipBasedSslResult": null,
      "ipBasedSslState": "NotConfigured",
      "name": "income-rec-tool-staging-api.azurewebsites.net",
      "sslState": "Disabled",
      "thumbprint": null,
      "toUpdate": null,
      "toUpdateIpBasedSsl": null,
      "virtualIPv6": null,
      "virtualIp": null
    },
    {
      "certificateResourceId": null,
      "hostType": "Repository",
      "ipBasedSslResult": null,
      "ipBasedSslState": "NotConfigured",
      "name": "income-rec-tool-staging-api.scm.azurewebsites.net",
      "sslState": "Disabled",
      "thumbprint": null,
      "toUpdate": null,
      "toUpdateIpBasedSsl": null,
      "virtualIPv6": null,
      "virtualIp": null
    }
  ],
  "hostNames": [
    "income-rec-tool-staging-api.azurewebsites.net"
  ],
  "hostNamesDisabled": false,
  "hostingEnvironmentProfile": null,
  "httpsOnly": false,
  "hyperV": false,
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.Web/sites/income-rec-tool-staging-api",
  "identity": null,
  "inProgressOperationId": null,
  "ipMode": "IPv4",
  "isDefaultContainer": null,
  "isXenon": false,
  "keyVaultReferenceIdentity": "SystemAssigned",
  "kind": "app,linux",
  "lastModifiedTimeUtc": "2026-02-27T15:51:37.833333",
  "location": "UK West",
  "managedEnvironmentId": null,
  "maxNumberOfWorkers": null,
  "name": "income-rec-tool-staging-api",
  "outboundIpAddresses": "20.162.90.147,20.162.91.54,20.162.88.28,20.162.90.148,20.162.91.73,20.162.91.120,20.162.57.127,20.162.57.150,20.254.244.32,20.162.57.178,20.162.57.170,20.162.56.197,51.140.210.107",
  "outboundVnetRouting": {
    "allTraffic": false,
    "applicationTraffic": false,
    "backupRestoreTraffic": false,
    "contentShareTraffic": false,
    "imagePullTraffic": false,
    "managedIdentityTraffic": false
  },
  "possibleOutboundIpAddresses": "20.162.90.147,20.162.91.54,20.162.88.28,20.162.90.148,20.162.91.73,20.162.91.120,20.162.57.127,20.162.57.150,20.254.244.32,20.162.57.178,20.162.57.170,20.162.56.197,20.162.57.217,20.254.240.200,20.162.89.61,20.162.89.249,20.162.90.130,20.162.90.98,20.162.90.20,20.162.90.173,20.162.89.10,20.162.88.235,20.162.90.212,20.162.89.252,20.162.89.33,20.162.91.141,20.162.91.146,20.162.91.97,20.162.91.162,20.162.91.158,51.140.210.107",
  "publicNetworkAccess": "Enabled",
  "redundancyMode": "None",
  "repositorySiteName": "income-rec-tool-staging-api",
  "reserved": true,
  "resourceConfig": null,
  "resourceGroup": "income-rec-tool-staging",
  "scmSiteAlsoStopped": false,
  "serverFarmId": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.Web/serverfarms/income-rec-tool-staging-plan",
  "siteConfig": {
    "acrUseManagedIdentityCreds": false,
    "acrUserManagedIdentityId": null,
    "alwaysOn": false,
    "antivirusScanEnabled": null,
    "apiDefinition": null,
    "apiManagementConfig": null,
    "appCommandLine": null,
    "appSettings": null,
    "autoHealEnabled": null,
    "autoHealRules": null,
    "autoSwapSlotName": null,
    "azureMonitorLogCategories": null,
    "azureStorageAccounts": null,
    "clusteringEnabled": false,
    "connectionStrings": null,
    "cors": null,
    "customAppPoolIdentityAdminState": null,
    "customAppPoolIdentityTenantState": null,
    "defaultDocuments": null,
    "detailedErrorLoggingEnabled": null,
    "documentRoot": null,
    "elasticWebAppScaleLimit": 0,
    "experiments": null,
    "fileChangeAuditEnabled": null,
    "ftpsState": null,
    "functionAppScaleLimit": null,
    "functionsRuntimeScaleMonitoringEnabled": null,
    "handlerMappings": null,
    "healthCheckPath": null,
    "http20Enabled": false,
    "http20ProxyFlag": null,
    "httpLoggingEnabled": null,
    "ipSecurityRestrictions": [
      {
        "action": "Allow",
        "description": "Allow all access",
        "headers": null,
        "ipAddress": "Any",
        "name": "Allow all",
        "priority": 2147483647,
        "subnetMask": null,
        "subnetTrafficTag": null,
        "tag": null,
        "vnetSubnetResourceId": null,
        "vnetTrafficTag": null
      }
    ],
    "ipSecurityRestrictionsDefaultAction": null,
    "javaContainer": null,
    "javaContainerVersion": null,
    "javaVersion": null,
    "keyVaultReferenceIdentity": null,
    "limits": null,
    "linuxFxVersion": "",
    "loadBalancing": null,
    "localMySqlEnabled": null,
    "logsDirectorySizeLimit": null,
    "machineKey": null,
    "managedPipelineMode": null,
    "managedServiceIdentityId": null,
    "metadata": null,
    "minTlsCipherSuite": null,
    "minTlsVersion": null,
    "minimumElasticInstanceCount": 0,
    "netFrameworkVersion": null,
    "nodeVersion": null,
    "numberOfWorkers": 1,
    "phpVersion": null,
    "powerShellVersion": null,
    "preWarmedInstanceCount": null,
    "publicNetworkAccess": null,
    "publishingPassword": null,
    "publishingUsername": null,
    "push": null,
    "pythonVersion": null,
    "remoteDebuggingEnabled": null,
    "remoteDebuggingVersion": null,
    "requestTracingEnabled": null,
    "requestTracingExpirationTime": null,
    "routingRules": null,
    "runtimeADUser": null,
    "runtimeADUserPassword": null,
    "sandboxType": null,
    "scmIpSecurityRestrictions": [
      {
        "action": "Allow",
        "description": "Allow all access",
        "headers": null,
        "ipAddress": "Any",
        "name": "Allow all",
        "priority": 2147483647,
        "subnetMask": null,
        "subnetTrafficTag": null,
        "tag": null,
        "vnetSubnetResourceId": null,
        "vnetTrafficTag": null
      }
    ],
    "scmIpSecurityRestrictionsDefaultAction": null,
    "scmIpSecurityRestrictionsUseMain": null,
    "scmMinTlsCipherSuite": null,
    "scmMinTlsVersion": null,
    "scmSupportedTlsCipherSuites": null,
    "scmType": null,
    "sitePort": null,
    "sitePrivateLinkHostEnabled": null,
    "storageType": null,
    "supportedTlsCipherSuites": null,
    "tracingOptions": null,
    "use32BitWorkerProcess": null,
    "virtualApplications": null,
    "vnetName": null,
    "vnetPrivatePortsCount": null,
    "vnetRouteAllEnabled": null,
    "webJobsEnabled": false,
    "webSocketsEnabled": null,
    "websiteTimeZone": null,
    "winAuthAdminState": null,
    "winAuthTenantState": null,
    "windowsConfiguredStacks": null,
    "windowsFxVersion": null,
    "xManagedServiceIdentityId": null
  },
  "sku": "Basic",
  "slotSwapStatus": null,
  "sshEnabled": null,
  "state": "Running",
  "storageAccountRequired": false,
  "suspendedTill": null,
  "tags": null,
  "targetSwapSlot": null,
  "trafficManagerHostNames": null,
  "type": "Microsoft.Web/sites",
  "usageState": "Normal",
  "virtualNetworkSubnetId": null,
  "workloadProfileName": null
}



az webapp config appsettings set \
  --name income-rec-tool-staging-api \
  --resource-group income-rec-tool-staging \
  --settings \
    NODE_ENV=staging \
    PORT=8080 \
    CORS_ORIGIN="https://income-rec-tool-staging-web.azurestaticapps.net" \
    DATABASE_URL="postgresql://incomerecadmin:M10@dona123456@income-rec-tool-staging-db.postgres.database.azure.com:5432/income_rec_staging?sslmode=require" \
    ZOHO_CLIENT_ID="1000.3FICH6XXCVNRTYLURV3Z6ZD3RLXMSR" \
    ZOHO_CLIENT_SECRET="928e56fcf3e7e24aabc0cf544cbd0e510b7f0267ea" \
    ZOHO_REFRESH_TOKEN="1000.088fa856a369b25a307b2e59d5d76ce4.198167fa17d19bc02e48b03827ce631" \
    ZOHO_ACCOUNTS_URL="https://accounts.zoho.eu" \
    ZOHO_API_DOMAIN="https://www.zohoapis.eu" \
    AZURE_OPENAI_ENDPOINT="https://fh-openai-std-resource.cognitiveservices.azure.com" \
    AZURE_OPENAI_API_KEY="4WczkSz403ruO1mxEAA7F1rgHgmRYjCVEB88fkE5h7cOBGi3wb7PJQQJ99BLACmepeSXJ3w3AAAAACOGpug4" \
    AZURE_OPENAI_DEPLOYMENT="gpt-4.1" \
    AZURE_OPENAI_API_VERSION="2025-01-01-preview" \
    APPINSIGHTS_INSTRUMENTATIONKEY="389a01e8-8613-481a-a897-1059ae4cdc1e"


Password: M10@dona123456






AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az webapp config set \
  --name income-rec-tool-staging-api \
  --resource-group income-rec-tool-staging \
  --startup-file "node dist/index.js"
{
  "acrUseManagedIdentityCreds": false,
  "acrUserManagedIdentityId": null,
  "alwaysOn": false,
  "apiDefinition": null,
  "apiManagementConfig": null,
  "appCommandLine": "node dist/index.js",
  "appSettings": null,
  "autoHealEnabled": false,
  "autoHealRules": null,
  "autoSwapSlotName": null,
  "azureStorageAccounts": {},
  "connectionStrings": null,
  "cors": null,
  "defaultDocuments": [
    "Default.htm",
    "Default.html",
    "Default.asp",
    "index.htm",
    "index.html",
    "iisstart.htm",
    "default.aspx",
    "index.php",
    "hostingstart.html"
  ],
  "detailedErrorLoggingEnabled": false,
  "documentRoot": null,
  "elasticWebAppScaleLimit": 0,
  "experiments": {
    "rampUpRules": []
  },
  "ftpsState": "FtpsOnly",
  "functionAppScaleLimit": null,
  "functionsRuntimeScaleMonitoringEnabled": false,
  "handlerMappings": null,
  "healthCheckPath": null,
  "http20Enabled": true,
  "http20ProxyFlag": 0,
  "httpLoggingEnabled": false,
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.Web/sites/income-rec-tool-staging-api",
  "ipSecurityRestrictions": [
    {
      "action": "Allow",
      "description": "Allow all access",
      "headers": null,
      "ipAddress": "Any",
      "name": "Allow all",
      "priority": 2147483647,
      "subnetMask": null,
      "subnetTrafficTag": null,
      "tag": null,
      "vnetSubnetResourceId": null,
      "vnetTrafficTag": null
    }
  ],
  "ipSecurityRestrictionsDefaultAction": null,
  "javaContainer": null,
  "javaContainerVersion": null,
  "javaVersion": null,
  "keyVaultReferenceIdentity": null,
  "kind": null,
  "limits": null,
  "linuxFxVersion": "NODE|22-lts",
  "loadBalancing": "LeastRequests",
  "localMySqlEnabled": false,
  "location": "UK West",
  "logsDirectorySizeLimit": 35,
  "machineKey": null,
  "managedPipelineMode": "Integrated",
  "managedServiceIdentityId": null,
  "metadata": null,
  "minTlsCipherSuite": null,
  "minTlsVersion": "1.2",
  "minimumElasticInstanceCount": 1,
  "name": "income-rec-tool-staging-api",
  "netFrameworkVersion": "v4.0",
  "nodeVersion": "",
  "numberOfWorkers": 1,
  "phpVersion": "",
  "powerShellVersion": "",
  "preWarmedInstanceCount": 0,
  "publicNetworkAccess": null,
  "publishingUsername": "REDACTED",
  "push": null,
  "pythonVersion": "",
  "remoteDebuggingEnabled": false,
  "remoteDebuggingVersion": "VS2022",
  "requestTracingEnabled": false,
  "requestTracingExpirationTime": null,
  "resourceGroup": "income-rec-tool-staging",
  "scmIpSecurityRestrictions": [
    {
      "action": "Allow",
      "description": "Allow all access",
      "headers": null,
      "ipAddress": "Any",
      "name": "Allow all",
      "priority": 2147483647,
      "subnetMask": null,
      "subnetTrafficTag": null,
      "tag": null,
      "vnetSubnetResourceId": null,
      "vnetTrafficTag": null
    }
  ],
  "scmIpSecurityRestrictionsDefaultAction": null,
  "scmIpSecurityRestrictionsUseMain": false,
  "scmMinTlsVersion": "1.2",
  "scmType": "None",
  "tracingOptions": null,
  "type": "Microsoft.Web/sites",
  "use32BitWorkerProcess": true,
  "virtualApplications": [
    {
      "physicalPath": "site\\wwwroot",
      "preloadEnabled": false,
      "virtualDirectories": null,
      "virtualPath": "/"
    }
  ],
  "vnetName": "",
  "vnetPrivatePortsCount": 0,
  "vnetRouteAllEnabled": false,
  "webSocketsEnabled": false,
  "websiteTimeZone": null,
  "windowsFxVersion": null,
  "xManagedServiceIdentityId": null
}




AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az staticwebapp create \
  --name income-rec-tool-staging-web \
  --resource-group income-rec-tool-staging \
  --location westeurope
{
  "allowConfigFileUpdates": true,
  "branch": null,
  "buildProperties": null,
  "contentDistributionEndpoint": "https://content-am2.infrastructure.6.azurestaticapps.net",
  "customDomains": [],
  "databaseConnections": [],
  "defaultHostname": "victorious-desert-01520d703.6.azurestaticapps.net",
  "enterpriseGradeCdnStatus": "Disabled",
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.Web/staticSites/income-rec-tool-staging-web",
  "identity": null,
  "keyVaultReferenceIdentity": "SystemAssigned",
  "kind": null,
  "linkedBackends": [],
  "location": "West Europe",
  "name": "income-rec-tool-staging-web",
  "privateEndpointConnections": [],
  "provider": "None",
  "publicNetworkAccess": null,
  "repositoryToken": null,
  "repositoryUrl": null,
  "resourceGroup": "income-rec-tool-staging",
  "sku": {
    "capabilities": null,
    "capacity": null,
    "family": null,
    "locations": null,
    "name": "Free",
    "size": null,
    "skuCapacity": null,
    "tier": "Free"
  },
  "stagingEnvironmentPolicy": "Enabled",
  "tags": null,
  "templateProperties": null,
  "type": "Microsoft.Web/staticSites",
  "userProvidedFunctionApps": null
}





AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az staticwebapp secrets list \
  --name income-rec-tool-staging-web \
  --resource-group income-rec-tool-staging \
  --query "properties.apiKey" \
  --output tsv
7b6df87f3139e405161bcf3e4f31335320c9dba93500716598238ef87130f48406-d61aa55f-4dd5-40b5-99f7-517c8994fa3c003280801520d703



AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az staticwebapp appsettings set \
  --name income-rec-tool-staging-web \
  --resource-group income-rec-tool-staging \
  --setting-names \
    VITE_API_URL="https://income-rec-tool-staging-api.azurewebsites.net"
App settings have been redacted. Use `az staticwebapp appsettings list` to view.
{
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.Web/staticSites/income-rec-tool-staging-web/config/appsettings",
  "kind": null,
  "location": "West Europe",
  "name": "appsettings",
  "properties": {
    "VITE_API_URL": null
  },
  "resourceGroup": "income-rec-tool-staging",
  "type": "Microsoft.Web/staticSites/config"
}

AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az staticwebapp appsettings list \
  --name income-rec-tool-staging-web \
  --resource-group income-rec-tool-staging
{
  "id": "/subscriptions/5aadac3d-4ce6-4394-8ef2-cc48ea7a6822/resourceGroups/income-rec-tool-staging/providers/Microsoft.Web/staticSites/income-rec-tool-staging-web/config/appsettings",
  "kind": null,
  "location": "West Europe",
  "name": "appsettings",
  "properties": {
    "VITE_API_URL": "https://income-rec-tool-staging-api.azurewebsites.net"
  },
  "resourceGroup": "income-rec-tool-staging",
  "type": "Microsoft.Web/staticSites/config"
}


AzureAD+AldrinKanthasamy@CHLP0025 MINGW64 ~
$ az webapp deployment list-publishing-profiles \
  --name income-rec-tool-staging-api \
  --resource-group income-rec-tool-staging \
  --xml
<publishData><publishProfile profileName="income-rec-tool-staging-api - Web Deploy" publishMethod="MSDeploy" publishUrl="income-rec-tool-staging-api.scm.azurewebsites.net:443" msdeploySite="income-rec-tool-staging-api" userName="REDACTED" userPWD="REDACTED" destinationAppUrl="http://income-rec-tool-staging-api.azurewebsites.net" SQLServerDBConnectionString="REDACTED" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile><publishProfile profileName="income-rec-tool-staging-api - FTP" publishMethod="FTP" publishUrl="ftps://waws-prod-cw1-037.ftp.azurewebsites.windows.net/site/wwwroot" ftpPassiveMode="True" userName="REDACTED" userPWD="REDACTED" destinationAppUrl="http://income-rec-tool-staging-api.azurewebsites.net" SQLServerDBConnectionString="REDACTED" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile><publishProfile profileName="income-rec-tool-staging-api - Zip Deploy" publishMethod="ZipDeploy" publishUrl="income-rec-tool-staging-api.scm.azurewebsites.net:443" userName="REDACTED" userPWD="REDACTED" destinationAppUrl="http://income-rec-tool-staging-api.azurewebsites.net" SQLServerDBConnectionString="REDACTED" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile></publishData>