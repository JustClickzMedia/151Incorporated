import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { RouterLink } from '@angular/router';
import { faUserTie, faUserGraduate, faUsers } from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'app-homebuttonsection',
    templateUrl: './homebuttonsection.component.html',
    styleUrls: ['./homebuttonsection.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [FontAwesomeModule, RouterLink]
})
export class HomebuttonsectionComponent implements OnInit {
  constructor() { }

  ngOnInit() {
  }

  faUserTie=faUserTie;
  faUserGraduate=faUserGraduate;
  faUsers = faUsers;

}
