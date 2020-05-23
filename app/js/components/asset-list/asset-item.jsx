import React from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import $ from 'jquery'
import dateFormat from 'dateformat'

import '../../lib/time.utils.js'

class AssetItem extends React.Component {
  static propTypes = {
    item: PropTypes.object.isRequired
  }

  state = {
    loading: true
  }

  componentDidMount() {
    if (this.props.item.data)
      this.setState({data: JSON.parse(this.props.item.data)});
  }

  render() {
    const {item, forMembership, ...props} = this.props;

    switch (this.props.item.type) {
      case 'sound':
        var itemHtml = <div
          className={'item flex center space-between' + (this.props.selected ? ' selected' : '')}
          {...props}
          onDragStart={this.handleDragStart}>
          <div className="flex center">
            <div className="img_wrapper">
              { this.props.item.is_club ?
                <div className="club-badge">
                  <span><nobr>Doodly Club:</nobr> <nobr>{dateFormat(new Date(this.props.item.club_month + ' UTC'), 'mmmm yyyy')}</nobr></span>
                </div>
              : this.props.item.is_pro && !this.props.forMembership ?
                <div className="pro-badge"/>
              :
                ''
              }
              <i className="fa fa-music fa-3x"/>
            </div>
            {
              this.props.item.title &&
              <div className="title">
                {this.props.item.title}
              </div>
            }
          </div>
          <div className="flex center">
            {this.state.data && this.state.data.duration.toMMSS()}
            <button className="btn clear" onClick={this.soundPlayPause}>
              <i className={'fa fa-2x ' + (this.state.buffering ? 'fa-refresh fa-spin' : this.state.playing ? 'fa-pause-circle-o' : 'fa-play-circle-o') }/>
            </button>
          </div>
        </div>
        break;
      default:
        var itemHtml = <div>
            <div
              className={
                'item flex center space-around' +
                (this.props.item.status == 'none' && !this.state.loading ? ' pending' : '') +
                (this.props.selected ? ' selected' : '')
              }
              {...props}
              onDragStart={this.handleDragStart}>
              <i className={this.state.loading ? 'spinner fa fa-2x fa-refresh fa-spin' : 'hidden'}/>
              <img
                className={this.state.loading ? 'hidden' : ''}
                src={this.props.item.thumb_path}
                onLoad={this.handleItemLoaded}
                draggable={false}/>
            </div>
            {
              this.props.item.type != 'font' && this.props.item.title &&
              <div className="title flex space-around">
                <div className="flex center">
                  { this.props.item.is_club ?
                    <div className="club-badge">
                      <span><nobr>Doodly Club:</nobr> <nobr>{dateFormat(new Date(this.props.item.club_month + ' UTC'), 'mmmm yyyy', true)}</nobr></span>
                    </div>
                  : this.props.item.is_pro && !this.props.forMembership ?
                    <div className="pro-badge"/>
                  :
                    ''
                  }
                  {this.props.item.title}
                </div>
              </div>
            }
          </div>
    }
    return itemHtml;
  }

  handleItemLoaded = () => {
    this.setState({loading: false});
    var image = new Image();
    image.onload = () => {
      if (image.width > 250 || image.height > 250) {
        let canvas = document.createElement('canvas');
        var newWidth, newHeight;

        if (image.width > image.height) {
          newWidth = 250;
          newHeight = 250 / image.width * image.height;
        } else {
          newHeight = 250;
          newWidth = 250 / image.height * image.width;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        let ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, newWidth, newHeight);

        let dragImage = new Image();
        dragImage.src = canvas.toDataURL();

        this.setState({dragImage: dragImage});
      }
    }
    image.src = this.props.item.thumb_path;
  }

  handleDragStart = (e) => {
    var img = new Image();
    img.src = this.props.item.thumb_path;

    if (this.props.item.type == 'image') {
      img = this.state.dragImage || img;
      e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
    }
    if (this.props.item.type == 'font')
      e.dataTransfer.setDragImage(img, 160, 30);
    if (this.props.item.type == 'sound')
      e.dataTransfer.setDragImage(ReactDOM.findDOMNode(this), 160, 30);

    e.dataTransfer.setData('item', JSON.stringify(this.props.item));
    // need to add item to local storage
    // so we can access the properties before droppping the item
    localStorage.setItem('draggedItem', JSON.stringify(this.props.item));
  }

  soundPlayPause = (e) => {
    e.stopPropagation();
    if (!this.state.audio) {
      var audio = document.createElement('audio');

      audio.onloadeddata = () => {
        this.setState({
          buffering: false,
          playing: true
        });
        this.state.audio.play();
      };

      audio.onended = () => {
        this.setState({
          playing: false
        })
      };

      audio.src = this.props.item.path;

      this.setState({
        audio: audio,
        buffering: true
      });
    } else {
      if (this.state.playing) {
        this.state.audio.pause();
        this.setState({playing: false});
      } else {
        this.state.audio.play();
        this.setState({playing: true});
      }
    }
  }

}

export default AssetItem
