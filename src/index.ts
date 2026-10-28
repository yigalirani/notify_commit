//const EMAIL_FROM = "yigal@symbolclick.com";  //you have to have to set up premission to send email as described in https://developers.google.com/identity/protocols/oauth2/service-account 
//const EMAIL_TO = "yigal_i@hotmail.com"; 

import crypto from "node:crypto";
import {run_report} from './report.js'
import { readFileSync } from 'node:fs';
import { cleanEnv, makeValidator, email, str } from 'envalid';
export interface KeyPair {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

export interface TokenResponse {
  access_token: string;
  scope?: string;
  token_type: string;
  expires_in: number;
}

function require_string(value: Record<string, unknown>, field: string): string {
  const v = value[field];
  if (typeof v !== "string") {
    throw new Error(`config field "${field}" must be a string`);
  }
  return v;
}

function parse_key_pair(config_data: string): KeyPair {
  try {
    const parsed = JSON.parse(config_data) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("config is not an object");
    }
    const obj = parsed as Record<string, unknown>;
    for (const field of [
      "type",
      "project_id",
      "private_key_id",
      "private_key",
      "client_email",
      "client_id",
      "auth_uri",
      "token_uri",
      "auth_provider_x509_cert_url",
      "client_x509_cert_url",
      "universe_domain",
    ]) {
      require_string(obj, field);
    }
    return parsed as KeyPair;
  } catch (ex) {
    if (ex instanceof Error) {
      console.error("failed open config data,", ex.message);
    }
    throw new Error("failed open config file", { cause: ex });
  }
}

function parse_token_response(config_data: string): TokenResponse {
  const parsed = JSON.parse(config_data) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("token response is not an object");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.access_token !== "string") {
    throw new Error("token response missing access_token");
  }
  if (typeof obj.token_type !== "string") {
    throw new Error("token response missing token_type");
  }
  if (typeof obj.expires_in !== "number") {
    throw new Error("token response missing expires_in");
  }
  const { scope } = obj;
  if (scope !== undefined && typeof scope !== "string") {
    throw new Error("token response scope must be a string");
  }
  return {
    access_token: obj.access_token,
    scope,
    token_type: obj.token_type,
    expires_in: obj.expires_in,
  };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createJwt(key:KeyPair,email_from:string): string {
  //const key=JSON.parse(readFile('key.json','utf8'))
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    sub: email_from,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimB64 = base64url(JSON.stringify(claim));
  const data = `${headerB64}.${claimB64}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(data), key.private_key);
  return `${data}.${base64url(signature)}`;
}

class Gmail{
  key
  access_token:string|undefined
  constructor(public keypair:string,public email_from:string){
    this.key= parse_key_pair(keypair)
  }      
  async  getAccessToken(): Promise<string> {
    const jwt =  createJwt(this.key,this.email_from);
    console.log({jwt})
    const request_init={
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    }
    const res = await fetch("https://oauth2.googleapis.com/token",request_init);

    if (!res.ok) throw new Error(await res.text());
    const json = parse_token_response(await res.text());
    console.log({json})
    return json.access_token;
  }
  async send({title,to,content}:{
    title:string,
    to:string[],
    content:string
  }){
    
  const token = await this.getAccessToken();

  const rawMessage =
  `from: <${this.email_from}>
encoding: text/html
to: ${to.join(', ')}
subject: ${title}
Content-Type: text/html; charset="UTF-8"

${content}`;

  const rawMessage2=rawMessage.replaceAll('\n','\r\n')
  const raw = base64url(rawMessage2)//Buffer.from(rawMessage).toString("base64"));
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) throw new Error(await res.text());
  console.log("Sent:", await res.text());
  }
}
  
const email_list = makeValidator((input: string): string[] => {
  const parts=input.split(',').map((part) => part.trim()).filter((part) => part.length>0)
  if (parts.length===0) throw new Error('must contain at least one email address')
  return parts.map((part) => email()._parse(part))
})

function validate_env(){
  return cleanEnv(process.env, {
    KEYJSON: str({ desc: 'Gmail service-account key as a JSON string' }),
    KEYFROM: email({ desc: "Sender's email address" }),
    KEYTO: email_list({ desc: 'Comma-separated list of recipient email addresses' }),
  })
}

async function main(){
  const env=validate_env()
  const gmail=new Gmail(env.KEYJSON,env.KEYFROM)
  const {content,description}=await run_report()
  await gmail.send({
    title:description.substring(0,78),
    to:env.KEYTO,
    content
  })
}
void main()
//sendMail().catch(console.error);
