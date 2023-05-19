import { LitElement, PropertyValueMap, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import "@views/main/group-list/GroupList"
import "@views/main/group/Group"
import "@views/bottom-navbar/BottomNavbar"

import type { TotalData } from "@views/App";

@customElement("view-main")
class Main extends LitElement {
  @property()
  data?: TotalData;

  /**
   * group id 1 = "etc", 0 = "all"
   */
  @state()
  _currentGroupId = 0; 

  @query("view-group-list")
  ViewGroupList: Element;

  @query("view-bottom-navbar")
  ViewBottomNavbar: Element;

  constructor() {
    super() ;

    this.addEventListener(
      "bottom-nav-bar",
      (e: CustomEvent) => {
        // you can check event origin by e.detail.origin
        if(e.detail.type === "AOT") {
          // pass, not needed right now
        }
        else if (e.detail.type === "change group name") {
          // this._data
        }
        else if (e.detail.type === "go home") {
          // this._currentGroup
        }
        else if (e.detail.type === "change mode") {
          // this._playerMode
        }
        else if (e.detail.type === "open setting") {

        }
        console.log(e.detail)
      }
    )
  }
  connectSocketForChannel(channel: TChannel) {
    // TODO: socket connection for getting live event
  }

  protected willUpdate(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
    if (!this.data) return;

    this.data.follow_list.forEach((channel) => {
      this.connectSocketForChannel(channel)
    })
  }

  protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
      this.ViewGroupList.addEventListener("select-group", (e:CustomEvent) => {
        this._currentGroupId = e.detail;

      });

      this.ViewGroupList.addEventListener("play-channel", (e:CustomEvent) => {
        // this.ViewBottomNavbar.getAttribute("playerMode");
        // this.render();
        // or
        // window.open
      });

      this.ViewBottomNavbar.addEventListener("home", (e:CustomEvent) => {

      })
  }

  render() {
    return html`
      <section>
        <view-group-list 
          .data=${this.data}
        ></view-group-list>

        <main>
          <view-group
            .groupId=${this._currentGroupId}
          ></view-group>
        </main>

        <view-bottom-navbar
        .AOT=${true}
        ></view-bottom-navbar>
      </section>

      <section>
<!-- Player -->
      </section>
    `;
  }
}
