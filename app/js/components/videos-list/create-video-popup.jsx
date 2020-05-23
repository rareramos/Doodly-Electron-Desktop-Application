import React from 'react'
import PropTypes from 'prop-types'
import $ from 'jquery'

import Hand from '../../hands.js'
import Modal from '../common/modal.jsx'

class CreateVideoPopup extends React.Component {
  static propTypes = {
    onVideoCreated: PropTypes.func.isRequired
  }

  state = {
    style: 'whiteboard',
    currentChalkboardStyle: 'blackboard',
  }

  render() {
    return (
      <Modal ref="modal" className="video-settings" title="Create new video">
        <div className="group">
          <label>Style:</label>
          <div className="flex center space-between">
            <div className={'style-wrapper' + (this.state.style == 'whiteboard' ? ' selected' : '')} onClick={this.setStyle.bind(this, 'whiteboard')}>
              <div className="style" style={{background: 'white', border: '1px solid #ccc'}}/>
              Whiteboard
            </div>
            <div className={'style-wrapper' + (this.state.style == 'blackboard' || this.state.style == 'greenboard' ? ' selected' : '')} onClick={this.setStyle.bind(this, this.state.currentChalkboardStyle)}>
              <div className="style" style={{background: this.state.currentChalkboardStyle == 'greenboard' ? '#2f5848' : '#333'}}>
                <div className="options flex column">
                  <div
                    className={'option' + (this.state.currentChalkboardStyle == 'blackboard' ? ' selected' : '')}
                    style={{background: '#333'}}
                    onClick={this.setStyle.bind(this, 'blackboard')}/>
                  <div
                    className={'option' + (this.state.currentChalkboardStyle == 'greenboard' ? ' selected' : '')}
                    style={{background: '#2f5848'}}
                    onClick={this.setStyle.bind(this, 'greenboard')}/>
                </div>
              </div>
              Chalkboard
            </div>
            <div className={'style-wrapper glassboard' +  (this.state.style == 'glassboard' ? ' selected' : '')} onClick={this.setStyle.bind(this, 'glassboard')}>
              <div className="style" style={{background: 'white', border: '1px solid #ccc'}}/>
              Glassboard
            </div>
          </div>
        </div>
        <div className="group">
          <label>Title:</label>
          <input type="text" ref="title" placeholder="No title" />
        </div>
        <div className="group">
          <div className="text-right">
            <a href="javascript:;" onClick={this.cancel}>Cancel</a>&nbsp;&nbsp;&nbsp;
            <button className="btn lg success" onClick={this.createNewVideo}>Create</button>
          </div>
        </div>
      </Modal>
    );
  }

  show = () => {
    this.refs.modal.show();
  }

  setStyle = (style, event) => {
    event.stopPropagation();
    this.setState({
      style: style,
      currentChalkboardStyle: (style == 'blackboard' || style == 'greenboard') ? style : this.state.currentChalkboardStyle,
    });
  }

  cancel = () => {
    this.refs.modal.hide()
  }

  createNewVideo = () => {
    this.refs.modal.hide();
    $('.toast').html('Creating new video...').fadeIn(500);
    $.post(server_url + '/videos', {
      title: this.refs.title.value || 'No title',
      style: this.state.style,
      hand_set: this.state.style == 'whiteboard' ? Hand.sets.default_whiteboard_set : Hand.sets.default_blackboard_set,
    })
      .done(video => {
        this.props.onVideoCreated(video);
      })
      .fail((request, textStatus, error) => this.props.handleAjaxFail(request, this.createNewVideo))
      .always(() => {
        $('.toast').fadeOut();
      })
  }

}

export default CreateVideoPopup
