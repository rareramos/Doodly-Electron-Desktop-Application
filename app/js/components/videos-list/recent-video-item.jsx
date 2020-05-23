import React from 'react'
import PropTypes from 'prop-types'

import '../../lib/time.utils.js'
import '../../lib/string.utils.js'

class RecentVideoItem extends React.Component {
  static propType = {
    item: PropTypes.object.isRequired,
    actionListener: PropTypes.func.isRequired
  }

  state = {
    loading: true
  }

  componentDidMount() {
    this.load();
  }
  componentDidUpdate(prevProps, prevState) {
    if (prevProps != this.props)
      this.load();
  }

  load = () => {
    let img = new Image();
    img.onload = () => {
      this.setState({ loading: false });
    }
    img.src = this.props.item.thumb_path;

    if (this.props.item.data) {
      var data = JSON.parse(this.props.item.data);
      this.setState({
        scenes: data.scenes,
        length: data.length.toHHMMSS(),
      })
    } else {
      this.setState({
        scenes: 0,
        length: '00:00:00'
      });
    }
  }

  render() {
    return (
      <div className={'recent-video-item flex column ' + this.props.item.style} onClick={this.edit} onContextMenu={this.props.onContextMenu}>
        <div className="background">
          <div className="flex center space-around img-wrapper" onClick={this.edit}>
            {this.state.loading && <i className="spinner fa fa-2x fa-refresh fa-spin"/>}
            {!this.state.loading &&
              <div className="img" style={{
                  visibility: this.state.loading ? 'hidden' : 'visible',
                  backgroundColor: this.props.item.style == 'greenboard' ? '#2f5848' : 'white',
                  backgroundImage: 'url(\'' + this.props.item.thumb_path + '\')',
                  backgroundSize: 'auto 100%',
                  backgroundRepeat: 'no-repeat',
                  backgroundBlendMode: this.props.item.style  == 'greenboard' ? 'screen' : 'multiply',
              }}/>
            }
          </div>
        </div>
        <span className="title">{this.props.item.title.shorten(34)}</span>
      </div>
    );
  }

  edit = (e) => {
    this.props.actionListener({action: 'edit_video', scope: this.props.item});
    e.stopPropagation();
  }

  delete = (e) => {
    this.props.actionListener({action: 'delete_video', video: this.props.item});
    e.stopPropagation();
  }

}

export default RecentVideoItem
