import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

export const authReady=!!process.env.AUTH_SECRET;
export const googleReady=authReady&&!!process.env.AUTH_GOOGLE_ID&&!!process.env.AUTH_GOOGLE_SECRET;
export const githubReady=authReady&&!!process.env.AUTH_GITHUB_ID&&!!process.env.AUTH_GITHUB_SECRET;
export const {handlers,auth,signIn,signOut}=NextAuth({
  secret:process.env.AUTH_SECRET,
  session:{strategy:'jwt',maxAge:8*60*60},
  pages:{signIn:'/login',error:'/login'},
  providers:[
    ...(googleReady?[Google({clientId:process.env.AUTH_GOOGLE_ID,clientSecret:process.env.AUTH_GOOGLE_SECRET})]:[]),
    ...(githubReady?[GitHub({clientId:process.env.AUTH_GITHUB_ID,clientSecret:process.env.AUTH_GITHUB_SECRET,authorization:{params:{scope:process.env.ALLOW_PRIVATE_REPOS==='true'?'read:user user:email':'read:user user:email public_repo'}}})]:[]),
  ],
  callbacks:{
    async jwt({token,account}){
      if(account){token.provider=account.provider;token.githubAccessToken=account.provider==='github'?account.access_token:undefined;}
      return token;
    },
    async session({session}){
      // Never expose OAuth access tokens to the browser.
      return session;
    },
  },
});
