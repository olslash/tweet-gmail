var readline = require('readline');
var googleapis = require('googleapis');
var credentials = require('./credentials.json');

var OAuth2Client = googleapis.OAuth2Client;

var CLIENT_ID = credentials.apiKeys.clientId;
var CLIENT_SECRET = credentials.apiKeys.clientSecret;
var REDIRECT_URL = credentials.apiKeys.redirect;

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
   * Authorize with Gmail:
 1 *   Try to auth with stored credentials from credentials.json.
 3 *     If the server returns an error, run getAccessToken to generate
 3 *     new credentials, then save them to credentials.json
 1 * Get a list of unread messages with the label SMS ("Label_12"), then fetch
 1 * the actual messages from the server.
 1 * see examples/batch.js -- use a batch request to get all messages at once.
   *
 2 * Take the responses, decode the body, and populate a menu. For an individual
   * message, you can choose to a) tweet it or b) ignore it. Ignored messages are
   * marked as 'read' in gmail. Any selected ones are tweeted. 
   *
   * If the message is too long to fit in a tweet, use a shortening api.
   * http://twishort.com/page/api ?
 */




function getAccessToken(oauth2Client, callback) {
  // generate consent page url
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // will return a refresh token
    scope: 'https://www.googleapis.com/auth/gmail.modify'
  });

  console.log('Visit the url: ', url);
  rl.question('Enter the code here:', function(code) {
    // request access token
    oauth2Client.getToken(code, function(err, tokens) {


      oauth2Client.setCredentials(tokens);
      
      callback();
    });
  });
}

function getUnreadMessageIds(client, authClient, callback) {
  // console.log(client.gmail.users.messages.list.toString());
  client
    .gmail.users.messages.list({
      userId: 'me', 
      labelIds: 'Label_12',
      q: 'from:camzig@gmail.com is:unread'})
    .withAuthClient(authClient)
    .execute(callback);
}

function getMailFromId(client, authClient, messageId, callback) {
  client
    .gmail.users.messages.get({
      userId: 'me', 
      id: messageId })
    .withAuthClient(authClient)
    .execute(callback);
}

googleapis
  .discover('gmail', 'v1')
  .execute(function(err, client) {

  var oauth2Client =
    new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

  // retrieve an access token
  // getAccessToken(oauth2Client, function() {
    // retrieve user profile
    oauth2Client.setCredentials(credentials.tokens);
    getUnreadMessageIds(client, oauth2Client, function(err, messages) {
      if (err) {
        // todo: probably need to refresh token
        console.log('error in getUnreadMessageIds', err); 
        return;
      }
      var messageBatch = client.newBatchRequest();

      messages.messages.forEach(function(message) {
        var request = client
          .gmail.users.messages.get({
            userId: 'me',
            id: message.id
          });
        messageBatch.add(request);
      });

      messageBatch
        .withAuthClient(oauth2Client)
        .execute(function(err, results) {
          if(err) { console.log('error in batch response:', err); }          

          results.forEach(function(message) {
            console.log(new Buffer(message.payload.body.data, 'base64').toString('ascii'));
          });
        });
    });
});