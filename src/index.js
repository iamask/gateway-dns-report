import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

export default {
    async scheduled(event, env) {
        const { API_TOKEN, SEND_EMAIL } = env;
        const SENDER_EMAIL = "socc@@example.com";
        const RECIPIENT_EMAIL = "alerts@example.com";
        const ACCOUNT_TAG = "xx";
        const DATE_24H_AGO = new Date(new Date() - 24 * 60 * 60 * 1000).toISOString();

        // Define GraphQL queries
        const queryBlockedDomains = `
            query Viewer {
                viewer {
                    accounts(filter: { accountTag: "${ACCOUNT_TAG}" }) {
                        gatewayResolverQueriesAdaptiveGroups(
                            filter: { datetime_gt: "${DATE_24H_AGO}", resolverDecision_in: [2, 3, 6, 9] },
                            limit: 10,
                            orderBy: [count_DESC]
                        ) {
                            count
                            dimensions { queryName }
                        }
                    }
                }
            }`;

        const queryAllowedDomains = `
            query Viewer {
                viewer {
                    accounts(filter: { accountTag: "${ACCOUNT_TAG}" }) {
                        gatewayResolverQueriesAdaptiveGroups(
                            filter: { datetime_gt: "${DATE_24H_AGO}", resolverDecision_in: [1, 4, 5, 10] },
                            limit: 10,
                            orderBy: [count_DESC]
                        ) {
                            count
                            dimensions { queryName }
                        }
                    }
                }
            }`;

        const queryCategoriesAllowed = `
            query Viewer {
                viewer {
                    accounts(filter: { accountTag: "${ACCOUNT_TAG}" }) {
                        gatewayResolverByCategoryAdaptiveGroups(
                            filter: {
                                datetime_gt: "${DATE_24H_AGO}"
                                categoryId_in: [2, 3, 6, 7, 9, 10, 12, 33, 15, 17, 32, 21, 22, 24, 26]
								resolverDecision_in: [1, 4, 5, 10]
                            },
                            orderBy: [count_DESC]
							limit: 10
                        ) {
                            count
                            dimensions { categoryId }
                        }
                    }
                }
            }`;



			const queryCategoriesBlocked = `
            query Viewer {
                viewer {
                    accounts(filter: { accountTag: "${ACCOUNT_TAG}" }) {
                        gatewayResolverByCategoryAdaptiveGroups(
                            filter: {
                                datetime_gt: "${DATE_24H_AGO}"
                                categoryId_in: [2, 3, 6, 7, 9, 10, 12, 33, 15, 17, 32, 21, 22, 24, 26]
								resolverDecision_in: [2, 3, 6, 9]
                            },
                            orderBy: [count_DESC],
							limit: 10
                        ) {
                            count
                            dimensions { categoryId }
                        }
                    }
                }
            }`;

        // Fetch query results
        const fetchQuery = async (query) => {
            const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });
            const result = await response.json();
			//console.log("GraphQL response:", result); // Log full response
            if (!result.data || result.errors) {
                console.error("GraphQL API error:", result.errors || "No data returned");
                throw new Error("Error fetching data from Cloudflare GraphQL API.");
            }
            return result.data;
        };

        try {
            const [blockedDomainsData, allowedDomainsData, categoriesAllowedData,categoriesBlockedData] = await Promise.all([
                fetchQuery(queryBlockedDomains),
                fetchQuery(queryAllowedDomains),
                fetchQuery(queryCategoriesAllowed),
				fetchQuery(queryCategoriesBlocked)
            ]);

            const blockedDomainsEvents = blockedDomainsData.viewer.accounts[0].gatewayResolverQueriesAdaptiveGroups;
            const allowedDomainsEvents = allowedDomainsData.viewer.accounts[0].gatewayResolverQueriesAdaptiveGroups;
            const categoriesAllowedEvents = categoriesAllowedData.viewer.accounts[0].gatewayResolverByCategoryAdaptiveGroups;
			const categoriesBlockedEvents = categoriesBlockedData.viewer.accounts[0].gatewayResolverByCategoryAdaptiveGroups;
			//console.log(categoriesAccessedEvents)


			const catergorylist = await fetch('https://api.cloudflare.com/client/v4/accounts/174f936387e2cf4c433752dc46ba6bb1/gateway/categories', {
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            })

			const catergorylistdata = await catergorylist.json()

			const categoryMap = {};
			catergorylistdata.result.forEach(category => {
			  categoryMap[category.id] = {
				name: category.name,
				description: category.description,
			  };
			});

			//console.log("categoryMap  :" + JSON.stringify(categoryMap))

			// Map the data from categoriesAllowedEvents to add names and descriptions
          const AllowedCategoriesmappedData = categoriesAllowedEvents.map(item => {
     	  const categoryId = item.dimensions.categoryId;
     	  return {
     	  count: item.count,
      	  name: categoryMap[categoryId]?.name || 'Unknown',
       	  description: categoryMap[categoryId]?.description || 'Description not available',
     		 };
   		 });


		 const BlockedCategoriesmappedData = categoriesBlockedEvents.map(item => {
				const categoryId = item.dimensions.categoryId;
				return {
				count: item.count,
				 name: categoryMap[categoryId]?.name || 'Unknown',
				  description: categoryMap[categoryId]?.description || 'Description not available',
				   };
				 });

			//console.log("mappedData  :" + JSON.stringify(mappedData))

	

            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DNS Gateway Report</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            background-color: #f9f9f9; 
            color: #333; 
            text-align: center; 
        }

        .table-container { 
            display: flex; 
            gap: 40px; /* Space between tables */
            justify-content: center; 
            margin-top: 20px; /* Space between the top of the page and the tables */
            flex-wrap: wrap; /* Allow tables to wrap to the next line if needed */
            background-color: #ffffff; /* Set a white background for the whole container */
        }

        .table-container div {
            margin-bottom: 40px; /* Add space between each table */
            background-color: #ffffff; /* Set a white background for each table's container */
            padding: 10px; /* Space between the table and the container's border */
        }

        table { 
            border-collapse: collapse; 
            width: 400px;  /* Increased table width */
            background-color: #fdfdff; 
            table-layout: fixed; /* Ensures equal width columns */
        }

        th, td { 
            padding: 10px; 
            background-color: #e8f0fe; 
            text-align: left;
            word-wrap: break-word; /* Ensures text wraps inside cells */
        }

        th { 
            background-color: #cce7ff; 
        }

    </style>
</head>
<body>
    <h1>DNS Gateway Report</h1>
    <div class="table-container">
        <div>
            <h2>Top Blocked Domains</h2>
            <table>
                <thead><tr><th>Domain</th><th>Count</th></tr></thead>
                <tbody>${blockedDomainsEvents.map(event => `<tr><td>${event.dimensions.queryName}</td><td>${event.count}</td></tr>`).join('')}</tbody>
            </table>
        </div>
        <div>
            <h2>Top Allowed Domains</h2>
            <table>
                <thead><tr><th>Domain</th><th>Count</th></tr></thead>
				<tbody>${allowedDomainsEvents.map(event => `<tr><td>${event.dimensions.queryName}</td><td>${event.count}</td></tr>`).join('')}</tbody>
            </table>
        </div>
		<div>
            <h2>Top Categories Allowed</h2>
            <table>
                 <thead><tr><th>Count</th><th>Category</th><th>Description</th></tr></thead>
                  <tbody>${AllowedCategoriesmappedData.map(event => `<tr><td>${event.count}</td><td>${event.name}</td><td>${event.description}</td></tr>`).join('')}</tbody>
            </table>
        </div>
		<div>
            <h2>Top Categories Blocked</h2>
            <table>
                 <thead><tr><th>Count</th><th>Category</th><th>Description</th></tr></thead>
                  <tbody>${BlockedCategoriesmappedData.map(event => `<tr><td>${event.count}</td><td>${event.name}</td><td>${event.description}</td></tr>`).join('')}</tbody>
            </table>
        </div>
		
    </div>
</body>
</html>




`;

            const msg = createMimeMessage();
            msg.setSender({ name: "Cloudflare Worker", addr: SENDER_EMAIL });
            msg.setRecipient(RECIPIENT_EMAIL);
            msg.setSubject("Domain Query Report");
            msg.addMessage({ contentType: 'text/html', data: htmlContent });

            const message = new EmailMessage(SENDER_EMAIL, RECIPIENT_EMAIL, msg.asRaw());
            await SEND_EMAIL.send(message);
            console.log("Email sent successfully!");
        } catch (error) {
            console.error("Error processing the scheduled event:", error);
        }
    }
};
