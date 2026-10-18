//const EMAIL_FROM = "yigal@symbolclick.com";  //you have to have to set up premission to send email as described in https://developers.google.com/identity/protocols/oauth2/service-account 
//const EMAIL_TO = "yigal_i@hotmail.com"; 

import crypto from "node:crypto";
import {run_report} from './report.js'
import { readFileSync } from 'node:fs';
import { TransformDecodeCheckError }       from '@sinclair/typebox/value';
import { Type,type Static,TSchema} from '@sinclair/typebox'
import { TypeCompiler }                    from "@sinclair/typebox/compiler";
import { report } from "node:process";
function read_typebox<T extends TSchema>(config_data: string, schema: T): Static<T > {
  try{
    //const config_data = await readFile(filename, "utf8");
    const compiler = TypeCompiler.Compile(schema);
    const parsed_json = JSON.parse(config_data)as unknown;
    const ans = compiler.Decode(parsed_json);
    return ans;
  }catch(ex){
    if (ex instanceof TransformDecodeCheckError){
      console.error("failed open config data,",ex.error.message,ex.error.path)
      throw new Error('failed open config file',{ cause: ex })
    }    
    if (ex instanceof Error){
      console.error("failed open config data,",ex.message)
    }
    throw new Error("failed open config file",{ cause: ex })
  }
}

export const key_pair_schema = Type.Object({
  type: Type.String(),
  project_id: Type.String(),
  private_key_id: Type.String(),
  private_key: Type.String(),
  client_email: Type.String(),
  client_id: Type.String(),
  auth_uri: Type.String(),
  token_uri: Type.String(),
  auth_provider_x509_cert_url: Type.String(),
  client_x509_cert_url: Type.String(),
  universe_domain: Type.String()
})

export const token_response_schema = Type.Object({
  access_token: Type.String(),
  scope: Type.Optional(Type.String()),
  token_type: Type.String(),
  expires_in: Type.Number(),
})

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createJwt(key:Static<typeof key_pair_schema>,email_from:string): string {
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
    this.key= read_typebox(keypair,key_pair_schema)
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
    const json = read_typebox(await res.text(), token_response_schema);
    console.log({json})
    return json.access_token;
  }
  async send({title,to,content}:{
    title:string,
    to:string,
    content:string
  }){
    
  const token = await this.getAccessToken();

  const rawMessage =
  `from: <${this.email_from}>
encoding: text/html
to: <${to}>
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
  
async function main(){
  const key= readFileSync('key.json','utf8')//src/index.ts:133:34 - error TS2345: Argument of type 'string' is not assignable to parameter of type '(err: ErrnoException | null, data: NonSharedBuffer) => void'.
  //const key=process.env.KEYJSON
  if (key==null)
    throw new Error('KEYJSON env var not found')
  const gmail=new Gmail(key,'yigal@symbolclick.com')
  const {content,description}=await run_report()
  await gmail.send({
    title:description.substring(0,78),
    to:'yigal.irani@gmail.com',
    content
  })
}
void main()
//sendMail().catch(console.error);
