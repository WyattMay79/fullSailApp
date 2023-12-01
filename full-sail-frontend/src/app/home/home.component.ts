import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';
import { Auth } from '@angular/fire/auth';
import { faStar } from '@fortawesome/free-solid-svg-icons'


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  faStar = faStar;

  isSignedIn: boolean = false;

  constructor(private auth: Auth, private userService: UserService ) {}
  
  ngOnInit() {
    this.auth.onAuthStateChanged(user => {
      this.isSignedIn = !!user;
    }); 
  }
  
  getRegisterPage(){
    this.userService.openRegisterDialog();
  }
}

