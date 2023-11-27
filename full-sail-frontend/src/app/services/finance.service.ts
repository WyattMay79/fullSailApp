import { Injectable } from '@angular/core';
import { Firestore, addDoc, doc, setDoc, getDoc, getDocs, collection, deleteDoc } from '@angular/fire/firestore';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { Transaction } from '../models/transaction';
import { AddTransactionComponent } from '../components/add-transaction/add-transaction.component';
import { EditTransactionComponent } from '../components/edit-transaction/edit-transaction.component';
import { DeleteTransactionComponent } from '../components/delete-transaction/delete-transaction.component';
import { Papa } from 'ngx-papaparse';
import { MatTableDataSource } from '@angular/material/table';
import { Goal } from '../models/goal';
import { AddGoalComponent } from '../components/add-goal/add-goal.component';
import { EditGoalComponent } from '../components/edit-goal/edit-goal.component';
import { DeleteGoalComponent } from '../components/delete-goal/delete-goal.component';
import { AccountComponent } from '../components/account/account.component';
import { SharedService } from './shared.service';


@Injectable({
  providedIn: 'root'
})
export class FinanceService {

  constructor(
    private papa: Papa,
    private auth: Auth,
    public dialog: MatDialog,
    private firestore: Firestore,
    private sharedService: SharedService
  ) { }

  

  async inputPaycheck(paycheckAmount: number, paycheckDate: Date, paycheckToGoals: boolean) {
    if (paycheckAmount > 0) {

      if (paycheckDate.setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0)) {
        paycheckDate = new Date();
      }

      const newTransaction = new Transaction(paycheckAmount, paycheckDate, paycheckToGoals, "Paycheck");
      console.log("Transaction being passed to transaction list and goals.", newTransaction);
      await this.inputTransactionFromParameter(newTransaction);
    } else {
      return alert("Paycheck must be a positive number");
    }
  }

  async inputTransactionFromParameter(transaction: Transaction) {
    console.log("Transaction being added to transaction list and goals.", transaction);
    await this.addTransactions(transaction);
    await this.addTransactionToGoals(transaction);
    await this.sharedService.accountTransactionsUpdate();
  }

  async inputCSV(csvString: string, contributeToGoals: boolean) {
    if (csvString) {
      this.papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        quoteChar: '"',
        complete: (result) => {
          const parsedData = result.data;
          const extractedData = parsedData.map(row => ({
            "Date": row["Effective Date"],
            "Amount": row["Amount"],
            "Description": row["Description"]
          }));
          console.log('Extracted Data: ', extractedData);

          this.csvToTransactionList(extractedData, contributeToGoals);
        },
        error: (error) => {
          console.error(error.message);

        }
      });
    }
  }

  csvToTransactionList(extractedData: any, contributeToGoals: boolean) {

    extractedData.forEach(transaction => {

      const dateParts = transaction.Date.split('/');

      const year = parseInt(dateParts[2], 10);
      const month = parseInt(dateParts[0], 10) - 1;
      const day = parseInt(dateParts[1], 10);

      const parsedDate = new Date(year, month, day);

      let transactionContribute = contributeToGoals;

      if (transaction.Amount <= 0) {
        transactionContribute = null;
      }

      const newTransaction = new Transaction(transaction.Amount, parsedDate, transactionContribute, transaction.Description);

      this.inputTransactionFromParameter(newTransaction);

    });

  }

  onFileSelected(event: any, contributeToGoals: boolean) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = reader.result as string;
        const csvString = content;
        this.inputCSV(csvString, contributeToGoals);
      };

      reader.readAsText(file);
    }
  }

  async getUserDetails() {
    try {
      const userCredential = await this.auth.currentUser;
      if (userCredential) {
        const user = userCredential;
        const displayName = user.displayName;
        return {
          uid: user.uid,
          displayName: displayName
        };
      }
    } catch (error) {
      console.log(error);
    }
    return null;
  }

  async addTransactions(transaction: Transaction) {
    const userDetails = await this.getUserDetails();
    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid

      // Iterating through the sample transactions and adding them to Firestore
      try {
        const docRef = await addDoc(collection(this.firestore, `users/${userId}/transactions`), {
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,

        });

        // Console.log the transaction data after the document is added
        const docSnapshot = await getDoc(docRef);
        if (docSnapshot.exists()) {
          console.log('Transaction data:', docSnapshot.data());
        }
      } catch (error) {
        console.error('Error: ', error);
      }

    }
    //console.log("4", "transaction added");

    // this.getTransactions();
  }

  async getTransactions() {
    const userDetails = await this.getUserDetails();
    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid
      const querySnapshot = await getDocs(collection(this.firestore, `users/${userId}/transactions`));
      let result = [];
      querySnapshot.forEach((doc) => {

        const docData = doc.data();
         docData.id = doc.id;
        result.push(docData);
      });
      return result.sort((a, b) => b.date - a.date);
    } else {
      return null;
    }
  }

  async getGoals() {
    const userDetails = await this.getUserDetails();
    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid
      const querySnapshot = await getDocs(collection(this.firestore, `users/${userId}/goals`));
      let goalList = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        docData.id = doc.id;
        goalList.push(docData);
      });
      console.log(goalList.sort((a, b) => b.dateCreated - a.dateCreated));
      return goalList.sort((a, b) => b.dateCreated - a.dateCreated);
    } else {
      return null;
    }
  }



  createGoal(name: string, amountPerPaycheck: number, total: number) {
    this.addGoal(new Goal(name, total, amountPerPaycheck, 0, new Date()));
    console.log("create Goal: ", new Date());
  }

  async addGoal(goal: Goal) {
    const userDetails = await this.getUserDetails();
    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid

      // Iterating through the sample transactions and adding them to Firestore

      try {
        const docRef = await addDoc(collection(this.firestore, `users/${userId}/goals`), {
          name: goal.name,
          total: goal.total,
          amountPerPaycheck: goal.amountPerPaycheck,
          balance: goal.balance,
          dateCreated: goal.dateCreated
        });

        // Console.log the transaction data after the document is added
        const docSnapshot = await getDoc(docRef);
        if (docSnapshot.exists()) {
          console.log('Goal data:', docSnapshot.data());
        }
      } catch (error) {
        console.error('Error: ', error);
      }
    }
    
    // this.getGoals();
  }


  //NEED TO ADD UPDATE AND DELETE FUNCTIONS FOR GOALS CARD

  //NEED TO ADD SETDOC FOR addTransactionToGoals() FOR GOALS UPDATE IN FIRESTORE
  // async is new


  async addTransactionToGoals(transaction: Transaction) {

    if (transaction.amount <= 0 || transaction.income === false || (transaction.contributeToGoals === false || null)) {
      console.log("The transaction being put in to be sent to goals. ", transaction);
      
      console.log("addtrantogoal 1st");
      return
    }
    let goalId: string;
    let goalTotal : number = 0;
    const goalList = await this.getGoals();
    await goalList.forEach(goal => {
      console.log(goal.amountPerPaycheck, parseInt(goal.amountPerPaycheck));
      goalId = goal.id;
      goalTotal += parseInt(goal.amountPerPaycheck);
    });

    console.log("goal Total: ", goalTotal);

    if (transaction.amount < goalTotal) {
      console.log("addtrantogoal 2st");
      return;
    }

    const userDetails = await this.getUserDetails();

    goalList.forEach(goal => {
      const goalDate = goal.dateCreated;
      const transactionDate = transaction.date;
      console.log("Tran Date");
      console.log(transaction.date)

      if (goalDate <= transactionDate) {
        goal.balance = parseInt(goal.amountPerPaycheck) + parseInt(goal.balance); //Add logic to update goal balance

        this.editGoalWithUserDetails(userDetails, goalId, goal);

        
        console.log("success", goal.balance);

      } else {
        console.log("addtrantogoal 3rd: Tran: ", transaction.date, "Goal: ", goal.dateCreated);
      }
    });
    this.sharedService.accountGoalUpdate();
  }

  async editGoalWithUserDetails(userDetails, goalId , goal: Goal) {
    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid;
      const goalDocRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
      const data = {  dateCreated: goal.dateCreated, name: goal.name, amountPerPaycheck: goal.amountPerPaycheck, balance: goal.balance, total: goal.total };
      try {
        await setDoc(goalDocRef, data, { merge: true });
        console.log('Updated goal: ', data);
      } catch (err) {
        console.log('Error: ', err);
      }
    }
  }


  //Transaction dialog button functions

  openTransactionDialog() {
    this.dialog.open(AddTransactionComponent, {
      width: '55%',
      height: '45%'
    })
  }

  openEditTransactionDialog(transactionId, date, description: string, amount: number) {
    this.dialog.open(EditTransactionComponent, {
      width: '55%',
      height: '50%',
      data: { transactionId, date, description, amount}
    })
  }

  openDeleteTransactionDialog(transactionId) {
    this.dialog.open(DeleteTransactionComponent, {
      width: '35%',
      height: '25%',
      data: { transactionId }
    });
  }


  async editTransactionButton(transactionId, date, description, amount) {
    const userDetails = await this.getUserDetails();

    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid;
      const transactionDocRef = doc(this.firestore, `users/${userId}/transactions/${transactionId}`);
      console.log(transactionId);
      const data = { date: date, amount: amount, description: description };
      try {
        await setDoc(transactionDocRef, data, { merge: true });
        console.log('Updated data: ', data);
      } catch (error) {
        console.error('Error: ', error);
      }
    }
  }

  async deleteTransactionButton(transactionId) {
    const userDetails = await this.getUserDetails();

    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid;
      const transactionDocRef = doc(this.firestore, `users/${userId}/transactions/${transactionId}`);
      console.log(transactionId);
      try {
        await deleteDoc(transactionDocRef);
        console.log('Transaction deleted');
      } catch (error) {
        console.error('Error:', error);
      }
    }
  }

  //Goal dialog functions

  openCreateGoalDialog() {
    this.dialog.open(AddGoalComponent, {
      width: '55%',
      height: '45%'
    })
  }

  openEditGoalDialog(goalId, dateCreated,  name, amountPerPaycheck, total, balance) {
    this.dialog.open(EditGoalComponent, {
      width: '55%',
      height: '45%',
      data: { goalId, dateCreated, name, amountPerPaycheck, total, balance }
    })
  }

  openDeleteGoalDialog(goalId) {
    this.dialog.open(DeleteGoalComponent, {
      width: '55%',
      height: '45%',
      data: { goalId }
    })
  }

  async editGoalButton(goalId, goal: Goal) {
    const userDetails = await this.getUserDetails();

    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid;
      const goalDocRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
      console.log(goalId);
      const data = {  dateCreated: goal.dateCreated, name: goal.name, balance: goal.balance, amountPerPaycheck: goal.amountPerPaycheck, total: goal.total };
      try {
        await setDoc(goalDocRef, data, { merge: true });
        console.log('Updated goal: ', data);
      } catch (err) {
        console.log('Error: ', err);
      }
    }
  }

  async deleteGoalButton(goalId) {
    const userDetails = await this.getUserDetails();

    if (userDetails && userDetails.uid) {
      const userId = userDetails.uid;
      const goalDocRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
      console.log(goalId);
      try {
        await deleteDoc(goalDocRef);
        console.log('goal successfully deleted!');
      } catch (error) {
        console.error('Error:', error);
      }
    }
  }













}
