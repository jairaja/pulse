"""Real concurrent SQL checks, only in the named disposable validation container.
Run after migrations; leaves test fixtures in that disposable database. Never targets a hosted URL.
"""
import concurrent.futures, json, os, subprocess, uuid
CONTAINER = os.environ.get('PULSE_TEST_CONTAINER', 'pulse-vote-reset-validation')
assert CONTAINER.startswith('pulse-') and CONTAINER.endswith('-validation'), 'Use a disposable validation container'
ENV = {k: v for k, v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
CMD = ['docker','--host=unix:///var/run/docker.sock','exec','-i',CONTAINER,'psql','-U','postgres','-d','postgres','-X','-t','-A','-v','ON_ERROR_STOP=1']
def sql(value, fail=False):
 r = subprocess.run(CMD,input=value,text=True,capture_output=True,env=ENV)
 if r.returncode and not fail: raise RuntimeError(r.stderr)
 return r.returncode, r.stdout.strip(), r.stderr
uid = lambda: str(uuid.uuid4())
actors = [uid() for _ in range(32)]; author = uid(); question = uid(); q1,q2=uid(),uid()
credential='concurrent-device-credential-'*3; device='9'*64
sql("insert into auth.users(id,email_confirmed_at) values"+','.join(f"('{u}',now())" for u in actors+[author])+';')
_, installation, _ = sql(f"select public.register_installation('{credential}',null,'{device}');")
sql("insert into private.account_sessions(account_id,session_id,installation_id,started_at,last_active_at) values"+','.join(f"('{u}','{u}','{installation}',now(),now())" for u in actors)+';')
sql(f"insert into public.questions(id,question_text,asked_on,status) values('{question}','Concurrency fixture daily question?',(now() at time zone 'utc')::date,'live');")
sql(f"insert into public.question_submissions(id,author_id,question_text,submitted_on,created_at,published_at) values('{q1}','{author}','Concurrent option one?',current_date-2,now()-interval '2 days',now()-interval '2 days'),('{q2}','{author}','Concurrent option two?',current_date-1,now()-interval '1 day',now()-interval '1 day');")
def upvote(index):
 u=actors[index]; target=q1 if index%2 else q2
 return sql(f"select public.accept_brewing_upvote('{u}','{u}','{credential}','{device}','{target}');",True)
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool: results=list(pool.map(upvote,range(32)))
assert sum(code==0 for code,_,_ in results)==1, results
assert all(code==0 or 'This device already used its upvote today' in err for code,_,err in results),results
assert sql(f"select count(*) from public.submission_votes where installation_id='{installation}';")[1]=='1'
print('32 concurrent accounts / one device / two targets: exactly one upvote; no deadlocks.')
def vote(_):
 return sql(f"select status from public.submit_vote('{credential}',null,'{question}','YES','{uid()}',null);",True)
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: results=list(pool.map(vote,range(24)))
assert all(code==0 for code,_,_ in results),results
assert [out for _,out,_ in results].count('ACCEPTED')==1,results
assert sql(f"select count(*) from public.votes where question_id='{question}';")[1]=='1'
print('24 concurrent guest submissions with distinct request keys: one acceptance and 23 duplicate receipts.')
imports=[uid(),uid()]; ceremonies=[uid(),uid()]; sessions=[uid(),uid()]
for index,account in enumerate(imports):
 email=f'{account}@example.test'; ceremony=ceremonies[index]
 sql(f"select public.begin_account_auth('{ceremony}',encode(extensions.digest(convert_to('{email}','utf8'),'sha256'),'hex'),'{credential}','{device}');")
 sql(f"insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('{account}','{email}',now(),'{{\"pulse_signup_ceremony\":\"{ceremony}\"}}');")
def claim(index):
 sql(f"select public.authorize_account_otp('{ceremonies[index]}',encode(extensions.digest(convert_to('{imports[index]}@example.test','utf8'),'sha256'),'hex'),'{device}');select public.bind_account_otp('{imports[index]}','{sessions[index]}','{ceremonies[index]}','{device}');")
 return sql(f"select public.complete_account_auth('{imports[index]}','{sessions[index]}','{ceremonies[index]}','{credential}','{device}',true);",True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(claim,range(2)))
assert all(code==0 for code,_,_ in results),results
assert sum(json.loads(out)['imported'] for _,out,_ in results)==1,results
assert sql(f"select count(*) from private.account_vote_history where question_id='{question}';")[1]=='1'
print('Two simultaneous signup imports on a shared device: exactly one canonical owner of the guest vote.')
account=imports[0]; email=f'{account}@example.test'; leases=[]
for _ in range(4):
 ceremony,sid=uid(),uid(); leases.append((ceremony,sid))
 sql(f"select public.begin_account_auth('{ceremony}',encode(extensions.digest(convert_to('{email}','utf8'),'sha256'),'hex'),'{credential}','{device}');")
def login(value):
 ceremony,sid=value
 sql(f"select public.authorize_account_otp('{ceremony}',encode(extensions.digest(convert_to('{email}','utf8'),'sha256'),'hex'),'{device}');select public.bind_account_otp('{account}','{sid}','{ceremony}','{device}');")
 return sql(f"select public.complete_account_auth('{account}','{sid}','{ceremony}','{credential}','{device}',true);",True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(login,leases))
assert all(code==0 for code,_,_ in results),results
winner=sql(f"select session_id from private.account_sessions where account_id='{account}';")[1]
assert winner in [sid for _,sid in leases]
for _,sid in leases:
 code,_,err=sql(f"select private.assert_account_session('{account}','{sid}');",True)
 assert (code==0)==(sid==winner),(sid,code,err)
print('Four simultaneous account logins: one current lease; all three replaced sessions reject authorization.')
