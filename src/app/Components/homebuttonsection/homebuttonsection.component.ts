import { Component, OnInit } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faUserTie, faUserGraduate, faUsers } from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'app-homebuttonsection',
    templateUrl: './homebuttonsection.component.html',
    styleUrls: ['./homebuttonsection.component.css'],
    imports: [FontAwesomeModule],
    standalone: true
})
export class HomebuttonsectionComponent implements OnInit {
  constructor() { }

  ngOnInit() {
  }

  faUserTie=faUserTie;
  faUserGraduate=faUserGraduate;
  faUsers = faUsers;

}
