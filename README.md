This worker allows you to send daily or weekly reports to your email (update cron and graphql filter accordingly)
It uses email worker, cron , email routing and graphql api
This is just a template, you can add any dimensions available in graphql firewallEventsAdaptiveGroups based on customer requirement.
Email routing will work only on full setup. You can create a subdomain zone (LTZ) as workaround.
Configure email routing : https://developers.cloudflare.com/email-routing/
Verify destination email : https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/