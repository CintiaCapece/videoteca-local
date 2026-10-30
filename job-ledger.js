'use strict';
const crypto=require('node:crypto');
function revision(video,type){return crypto.createHash('sha256').update(JSON.stringify([video.source_id,video.rel,video.size,video.mtime,type==='minutes'?video.transcript:null,type==='minutes'?video.transcript_segments:null])).digest('hex');}
function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
function counts(db,id){const row=db.prepare("SELECT COUNT(*) total,COALESCE(SUM(status IN ('succeeded','failed')),0) progress,COALESCE(SUM(status='failed'),0) errors FROM job_items WHERE job_id=?").get(id);db.prepare('UPDATE jobs SET total=?,progress=?,errors=? WHERE id=?').run(row.total,row.progress,row.errors,id);return row;}
function plan(db,job,rows){transaction(db,()=>{db.prepare('INSERT INTO jobs(id,type,status,payload,created,updated,planned,total) VALUES(?,?,?,?,?,?,1,?)').run(job.id,job.type,'queued',job.payload,job.stamp,job.stamp,rows.length);const insert=db.prepare('INSERT INTO job_items(job_id,video_id,position,revision,source_root,status) VALUES(?,?,?,?,?,?)');rows.forEach((v,i)=>insert.run(job.id,v.id,i,revision(v,job.type),db.prepare('SELECT root FROM sources WHERE id=?').get(v.source_id).root,'pending'));});}
function confirm(db,id,videoId,persist){transaction(db,()=>{persist();db.prepare("UPDATE job_items SET status='succeeded',message='' WHERE job_id=? AND video_id=?").run(id,videoId);counts(db,id);});}
module.exports={revision,transaction,counts,plan,confirm};
