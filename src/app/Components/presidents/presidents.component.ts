import { Component, OnInit } from '@angular/core';
import { WordpressService } from '../../Services/wordpress.service';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs/internal/Observable';

@Component({
  selector: 'app-presidents',
  templateUrl: './presidents.component.html',
  styleUrls: ['./presidents.component.css']
})
export class PresidentsComponent implements OnInit {
  page$ : Observable<any>;
  posts$ : Observable<any[]>;
  flamepost$: Observable<any[]>;
  

  constructor(private wp : WordpressService, private firestore: AngularFirestore) {
  } 

  ngOnInit() {
    this.page$ = this.wp.getPage(310);
    this.posts$ = this.wp.getPosts();
    console.log("Got here: ")
    this.firestore.doc("/fl_content/E3In7VJQAWMTHp4yaXam").get().subscribe( snap =>{
      console.log(snap.id);
      console.log(snap.data);
    });
    
  }

}
