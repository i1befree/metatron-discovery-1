/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import {ChangeDetectorRef, Component, ElementRef, EventEmitter, Injector, Input, Output, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AbstractPopupComponent} from '../../../common/component/abstract-popup.component';
import {PopupService} from '../../../common/service/popup.service';
import {CommonConstant} from '../../../common/constant/common.constant';
import {CookieConstant} from '../../../common/constant/cookie.constant';
import {isUndefined} from 'util';
import {DeleteModalComponent} from '../../../common/component/modal/delete/delete.component';
import {Modal} from '../../../common/domain/modal';
import {LineageService} from '../service/lineage.service';
import * as _ from 'lodash';
import {Alert} from "../../../common/util/alert.util";
import {saveAs} from 'file-saver';

declare let plupload: any;

@Component({
  selector: 'app-create-lineage-upload-file',
  templateUrl: './create-lineage-upload-file.component.html',
})
export class CreateLineageUploadFileComponent extends AbstractPopupComponent implements OnInit, OnDestroy {

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  @ViewChild('pickfiles')
  private pickfiles: ElementRef;

  @ViewChild('drop_container')
  private drop_container: ElementRef;

  public errorView: boolean = false;
  public errorMsg: string = null;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  @Input()
  public lineageData: any;

  @Output()
  public lineageDataChange = new EventEmitter();

  // file uploader
  public chunk_uploader: any;

  public changeDetect: ChangeDetectorRef;

  public uploadedFile: any;

  @Input()
  public createType : string;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Constructor
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 생성자
  constructor( private popupService: PopupService,
              private lineageService: LineageService,
              protected elementRef: ElementRef,
              protected injector: Injector) {

    super(elementRef, injector);

  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Override Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  public ngOnInit() {
    super.ngOnInit();

    this.initPlupload();
  }

  public ngOnDestroy() {
    super.ngOnDestroy();
    this.chunk_uploader = null;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  public downloadSample() {
    let downloadFileName = "lineage_sample.csv"
    this.lineageService.downloadSample().subscribe((sampleFile) => {
      saveAs(sampleFile, downloadFileName);
    });
  }

  public initPlupload() {

    this.chunk_uploader = new plupload.Uploader({
      runtimes : 'html5,html4',
      chunk_size: '0',
      browse_button : this.pickfiles.nativeElement,
      drop_element : this.drop_container.nativeElement,
      url : CommonConstant.API_CONSTANT.API_URL + 'metadatas/lineages/file_upload',
      headers:{
        'Accept': 'application/json, text/plain, */*',
        'Authorization': this.cookieService.get(CookieConstant.KEY.LOGIN_TOKEN_TYPE) + ' ' + this.cookieService.get(CookieConstant.KEY.LOGIN_TOKEN)
      },

      filters : {
        max_file_size : 0,
        prevent_duplicate: true,
        mime_types: [
          {title: "Lineage Edge files", extensions: "csv,txt"}
        ],

      },

      init: {
        PostInit: () => {
        },

        FilesAdded: (up, files) => {
          this.uploadedFile = null;
          this.lineageData = null;
          this.startUpload();
        },

        FileUploaded: (up, file, info)=>{
          this.lineageData = JSON.parse(info.response);
          if(file) {
            this.uploadedFile = {};
            if(file.name) {
              let fileName = file.name;
              this.uploadedFile.fileName = fileName;
              let len = fileName.length;
              if( 3<len ) {
                let lastDot = fileName.lastIndexOf('.');
                let ext = fileName.substring(lastDot, len).toLowerCase();

                this.uploadedFile.format = this.getFileFormat( ext );
              }
            }
            if(file.size) {
              this.uploadedFile.size = file.size;
            }
          } else {
            this.uploadedFile = null;
          }
          this.lineageData.uploaded = this.uploadedFile;

          this.lineageDataChange.emit(this.lineageData);
          this.changeDetect.detectChanges();
        },

        UploadComplete: (up, files) => {
        },

        /* error define
        -100 GENERIC_ERROR
        -200 HTTP_ERROR
        -300 IO_ERROR
        -400 SECURITY_ERROR
        -500 INIT_ERROR
        -600 FILE_SIZE_ERROR
        -601 FILE_EXTENSION_ERROR
        -602 FILE_DUPLICATE_ERROR
        -701 MEMORY_ERROR
         */
        Error: (up, err) => {
          switch (err.code){
            case -601:
              this.errorMsg = this.translateService.instant( 'msg.lineage.ui.alert.wrong.file.format' );
              this.errorView = true;
              break;
            default:
              Alert.error(this.translateService.instant(err.message));
              break;
          }
        }
      }
    });
    this.chunk_uploader.init();

  }

  /**
   * File Upload Cancel(Plupload)
   */
  public cancelUpload(file){
    if (file.status == plupload.UPLOADING) {
        this.chunk_uploader.stop();
        this.chunk_uploader.removeFile(file);
        this.chunk_uploader.start();
    }
  }

  /**
   * File Upload Start(Plupload)
   */
  public startUpload(){
      this.chunk_uploader.start();
  }

  /**
   * Disable Drag and Drop in File list area
   */
  public disableEvent(event:any){
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  /**
   * Next (confirm file)
   */
  public next() {
    if(this.lineageData) {
      this.popupService.notiPopup({
        name: 'confirm-grid',
        data: null
      });
    }
  }

  /**
   * Close Imported Popup
   */
  public close() {

    super.close();

    this.chunk_uploader.stop();

    this.popupService.notiPopup({
      name: 'close',
      data: null
    });
  }

  public getFileFormat(fileExtension: string) {
    let svgName: string = 'CSV';

    if(fileExtension) {
      let fileType : string = fileExtension.toUpperCase();
      switch(fileType) {
        case 'CSV':
          svgName = 'CSV';
          break;
        case 'TXT':
          svgName = 'TXT';
          break;
        case 'JSON':
          svgName = 'JSON';
          break;
        case 'XLSX':
          svgName = 'EXCEL';
          break;
        case 'XLS':
          svgName = 'EXCEL';
          break;
      }
    }

    return svgName;
  }

  public formatBytes(a,b) { // a=크기 , b=소숫점자릿
    if(0==a) return "0 Bytes";
    let c=1024,d=b||2,e=["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"],f=Math.floor(Math.log(a)/Math.log(c));
    return parseFloat((a/Math.pow(c,f)).toFixed(d))+" "+e[f]
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  private _errorView(){
    if (this.errorView) {
      setTimeout(() => {
        this.errorView = false;
        this.errorMsg = null;
      }, 3000);
    }
  }

}
