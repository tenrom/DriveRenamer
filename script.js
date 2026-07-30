
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
    if (urlParams.get("token")){
        console.log(urlParams.get("token"))
        ACCESS_TOKEN=urlParams.get("token")
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
    main()
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


function main(){

    let params = new URLSearchParams({
        fields: "*",
        access_token: ACCESS_TOKEN,
        orderBy:"folder,name",
        q:`"${urlParams.get("id") || "root"}" in parents and trashed = false`
    })

    fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`,{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(res => res.json())
        .then(json => {
            console.log(json)
            let container=document.getElementById('div_files')
            let html=""

            for(let file of json.files){
                html+=`<card-file data-folderId="${file.mimeType==="application/vnd.google-apps.folder" ? file.id : ""}" data-quality="64" data-icon="${file.iconLink}" data-name="${file.name}" data-fileLink="${file.webViewLink}"></card-file>`
            }

            container.innerHTML=html+"<div style='width:100%;height:20px;'></div>"
        })
}

class file extends HTMLElement{
    constructor(){
        super()
    }
    connectedCallback(){
        this.style=`
        width:100%;
        `

        this.innerHTML=`
        <div style="width:100%;height:50px;display:flex;flex-direction:row;justify-content:left;align-items:center;gap:10px;border-bottom:1px solid #c7c7c7">
            <img style="height:${this.getAttribute("data-folderId") ? 30 : 20}px;margin:0px ${this.getAttribute("data-folderId") ? 0 : 5}px;" src="${this.getAttribute('data-icon').replace("16",this.getAttribute('data-quality') || "16")}">
            <h2 class="google-sans-font" style="color:#1f1f1f;font-weight:500;font-size:1rem;">${this.getAttribute('data-name')}</h2>
        </div>
        `

        this.addEventListener('click',()=>{
            if (this.getAttribute("data-folderId")) {
                urlParams.set("id",this.getAttribute("data-folderId"))
                open(location.href.replace(location.search,"")+"?"+urlParams.toString(),"_self")
            }
            else {
                open(this.getAttribute("data-fileLink"),"_blank")
            }
        })
    }
}

window.customElements.define("card-file",file)