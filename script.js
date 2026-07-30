
let CLIENT_ID
let CLIENT_SECRET

let TOKEN_URI
let AUTH_URI
let REDIRECT_URI

let SCOPES
let ACCESS_TOKEN
let REFRESH_TOKEN

let urlParams
if (window.location.search){
    urlParams = new URLSearchParams(window.location.search);
}else{
    urlParams = new URLSearchParams('')
}

fetch('client_secret.json')
    .then(res => res.json())
    .then(res => {
        
        CLIENT_ID=res["web"]["client_id"]
        CLIENT_SECRET=res['web']['client_secret']

        TOKEN_URI=res["web"]["token_uri"]
        AUTH_URI=res["web"]["auth_uri"]
        REDIRECT_URI=res['web']['redirect_uris']

        SCOPES = 'https://www.googleapis.com/auth/drive';

        initialization()
    }).catch(error => console.log(error))

function authenticate(){
    open(`${AUTH_URI}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI[0]}&response_type=code&scope=${SCOPES}&access_type=offline&prompt=select_account`,"_self")
}

function initialization(){
    console.log(CLIENT_ID)
    if (urlParams.get("token")){
        console.log(urlParams.get("token"))
    }else if(urlParams.get("code")){
        if (localStorage.getItem('client_secret')){
            CLIENT_SECRET=localStorage.getItem('client_secret')
        }else{
            CLIENT_SECRET=prompt('Password')
            localStorage.setItem('client_secret',CLIENT_SECRET)
        }

        exchangeCodeForTokens(urlParams.get('code'),()=>{
            urlParams.delete('code',urlParams.get('code'))
            urlParams.set('token',ACCESS_TOKEN)
            open(location.href.replace(location.search,'')+'?'+urlParams.toString(),'_self')
        },false)
    }else{
        document.getElementById('btn_SignIn').style.display="block"
    }
}

function exchangeCodeForTokens(code,after,refresh) {
    // The parameters must be sent in a URL-encoded format
    let payload
    if (!refresh){
        payload = new URLSearchParams({
            'code': code,
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'redirect_uri': REDIRECT_URI[0],
            'grant_type': 'authorization_code'
        })
    }else{
        payload = new URLSearchParams({
            'refresh_token': code,
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'redirect_uri': REDIRECT_URI[0],
            'grant_type': 'refresh_token'
        })
    }
    
    console.log(payload)

    fetch(TOKEN_URI, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(), // Send the URL-encoded payload as the body
    })
    .then(async response => {
        if (!response.ok) {
            // If the response is not OK, we'll get the error details from the JSON body
            return response.json().then(errorData => {
                throw new Error(`Token exchange failed: ${response.status} - ${JSON.stringify(errorData)}`);
            });
        }
        // If the response is OK, parse the JSON data
        return response.json();
    })
    .then(tokenData => {
        // This is the data you need to store and use!
        console.log('Successfully received tokens:');
        console.log('Access Token:', tokenData.access_token);
        console.log('Refresh Token:', tokenData.refresh_token);
        console.log('Expires In:', tokenData.expires_in);
        console.log('Scope:', tokenData.scope);

        REFRESH_TOKEN=tokenData.refresh_token
        localStorage.setItem('refresh',JSON.stringify({'refresh_token':tokenData.refresh_token,'expires_in':tokenData.expires_in})) 
        ACCESS_TOKEN=tokenData.access_token

        after()
        // You would typically save the access and refresh tokens to a database here
        // and then send the access token to the client-side for API calls.
    })
    .catch(error => {
        // Handle any errors that occurred during the fetch or in the .then() blocks
        console.error('Error during token exchange:', error);
        localStorage.removeItem('client_secret')

        open(location.href,'_self')
        
    });
}